"""Worker do pipeline de extração do SIDPB (somente biblioteca padrão do Python 3.10+).

Roda na máquina onde está a LLM. Só faz conexões de SAÍDA para o SIDPB:
  1. pede um token ao Keycloak com a conta de serviço "sidpb-pipeline";
  2. reserva PDFs enviados por pessoas que aguardam extração;
  3. baixa cada PDF para PDF_DIR;
  4. chama extrair() (extrator.py), onde a equipe encaixa a extração de verdade;
  5. devolve o JSON para a MESMA submissão (o número viaja junto com o trabalho).

Uso:
  python worker.py --uma-vez          # processa o que houver e sai
  python worker.py                    # fica rodando, verificando a cada INTERVALO segundos
  python worker.py --enviar-jsonl x.jsonl   # envia extrações do RAG (cada linha vira uma submissão nova)

Configuração por variáveis de ambiente (ou arquivo .env ao lado deste script):
  SIDPB_API_URL           ex.: http://localhost:8080  (no servidor, o endereço da API via VPN)
  KEYCLOAK_TOKEN_URL      ex.: http://localhost:8081/realms/sidpb/protocol/openid-connect/token
  PIPELINE_CLIENT_ID      sidpb-pipeline
  PIPELINE_CLIENT_SECRET  segredo do cliente (Keycloak > Clients > sidpb-pipeline > Credentials)
  PDF_DIR                 pasta onde os PDFs baixados ficam (padrão: ./pdfs)
  INTERVALO               segundos entre verificações no modo contínuo (padrão: 300)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# import extrator  # desativado temporariamente: modo apenas download

HERE = Path(__file__).resolve().parent


def load_env() -> None:
    env_file = HERE / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def config(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        sys.exit(f"Configure a variável {name} (veja o cabeçalho de worker.py).")
    return value


class Sidpb:
    def __init__(self) -> None:
        self.api = config("SIDPB_API_URL").rstrip("/")
        self.token_url = config("KEYCLOAK_TOKEN_URL")
        self.client_id = config("PIPELINE_CLIENT_ID", "sidpb-pipeline")
        self.secret = config("PIPELINE_CLIENT_SECRET")
        self._token: str | None = None
        self._expires = 0.0

    def token(self) -> str:
        if self._token and time.time() < self._expires - 30:
            return self._token
        body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": self.client_id,
                                       "client_secret": self.secret}).encode()
        with urllib.request.urlopen(urllib.request.Request(self.token_url, data=body), timeout=30) as response:
            data = json.load(response)
        self._token, self._expires = data["access_token"], time.time() + data.get("expires_in", 60)
        return self._token

    def request(self, method: str, path: str, payload: dict | None = None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(self.api + path, data=data, method=method, headers={
            "Authorization": f"Bearer {self.token()}", **({"Content-Type": "application/json"} if data else {})})
        return urllib.request.urlopen(request, timeout=120)

    def json(self, method: str, path: str, payload: dict | None = None):
        with self.request(method, path, payload) as response:
            text = response.read().decode("utf-8")
            return json.loads(text) if text else None


def process_queue(sidpb: Sidpb, pdf_dir: Path, limit: int = 5) -> int:
    jobs = sidpb.json("POST", f"/api/pipeline/trabalhos/reservar?limite={limit}") or []
    for job in jobs:
        number = job["submissionId"]
        pdf = pdf_dir / f"sub-{number}__{(job.get('pdfSha256') or 'sem-hash')[:12]}.pdf"
        try:
            with sidpb.request("GET", f"/api/pipeline/trabalhos/{number}/pdf") as response:
                pdf.write_bytes(response.read())
            print(f"[baixado] submissão {number} -> {pdf}")
            # --- Extração e envio do resultado desativados temporariamente ---
            # result = extrator.extrair(pdf, titulo=job.get("title"))
            # payload = {"id": f"submissao:{number}", "model": getattr(extrator, "MODELO", None),
            #            "sumarization": result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)}
            # outcome = sidpb.json("POST", f"/api/pipeline/trabalhos/{number}/resultado", payload)
            # print(f"[ok] submissão {number}: {outcome['quality']}, {outcome['occurrences']} ocorrência(s)")
        except NotImplementedError as missing:
            sidpb.request("POST", f"/api/pipeline/trabalhos/{number}/devolver").close()
            sys.exit(f"[parado] {missing} — submissão {number} devolvida à fila.")
        except Exception as error:  # LLM fora do ar, rede etc.: devolve para tentar depois
            print(f"[erro] submissão {number}: {error} — devolvida à fila.")
            try:
                sidpb.request("POST", f"/api/pipeline/trabalhos/{number}/devolver").close()
            except Exception:
                pass  # se nem isso der, a reserva vence sozinha em 30 minutos
    return len(jobs)


def _extract_submission_id(record: dict) -> int | None:
    if record.get("submissionId") is not None:
        return int(record["submissionId"])
    rec_id = str(record.get("id") or "").strip()
    if rec_id.startswith("submissao:"):
        suffix = rec_id.split(":", 1)[1].strip()
        if suffix.isdigit():
            return int(suffix)
    name = Path(rec_id).name
    if name.startswith("sub-") and "__" in name:
        prefix = name.split("__", 1)[0].removeprefix("sub-")
        if prefix.isdigit():
            return int(prefix)
    return None


def send_jsonl(sidpb: Sidpb, file: Path) -> None:
    for number, line in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        record = json.loads(line)
        sumarization = record.get("sumarization")
        if sumarization is not None and not isinstance(sumarization, str):
            sumarization = json.dumps(sumarization, ensure_ascii=False)
        sub_id = _extract_submission_id(record)
        if sub_id is not None:
            payload = {"id": f"submissao:{sub_id}", "model": record.get("model"), "sumarization": sumarization}
            outcome = sidpb.json("POST", f"/api/pipeline/trabalhos/{sub_id}/resultado", payload)
            print(f"[{number}] resultado da submissão {sub_id}: {outcome['quality']}, {outcome['occurrences']} ocorrência(s)")
        else:
            outcome = sidpb.json("POST", "/api/pipeline/extracoes", {
                "id": record.get("id"), "model": record.get("model"), "sumarization": sumarization})
            status = "nova" if outcome["created"] else "já existia"
            print(f"[{number}] {status}: submissão {outcome['submissionId']}, {outcome['quality']}, {outcome['occurrences']} ocorrência(s)")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # acentos corretos no console do Windows
    load_env()
    parser = argparse.ArgumentParser(description="Worker do pipeline de extração do SIDPB")
    parser.add_argument("--uma-vez", action="store_true", help="processa a fila uma vez e sai")
    parser.add_argument("--enviar-jsonl", type=Path, help="envia extrações do RAG (uma por linha)")
    args = parser.parse_args()
    sidpb = Sidpb()
    if args.enviar_jsonl:
        send_jsonl(sidpb, args.enviar_jsonl)
        return
    pdf_dir = Path(os.environ.get("PDF_DIR", HERE / "pdfs"))
    pdf_dir.mkdir(parents=True, exist_ok=True)
    interval = int(os.environ.get("INTERVALO", "300"))
    while True:
        try:
            handled = process_queue(sidpb, pdf_dir)
            print(f"[fila] {handled} trabalho(s) processado(s).")
        except urllib.error.URLError as offline:
            print(f"[fila] SIDPB inacessível agora ({offline}); tento de novo depois.")
        if args.uma_vez:
            return
        time.sleep(interval)


if __name__ == "__main__":
    main()
