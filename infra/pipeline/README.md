# Pipeline de extração ↔ SIDPB

Duas entradas, as duas terminam como ocorrências **não curadas** no mapa e na fila do curador:

| Origem | Como chega | Comando |
|---|---|---|
| Artigos do RAG (equipe) | cada extração cria uma submissão nova | `python worker.py --enviar-jsonl saida.jsonl` |
| PDFs enviados no site | o worker reserva o PDF, extrai e devolve para **a mesma submissão** | `python worker.py --uma-vez` ou `python worker.py` (contínuo) |

O worker só faz conexões **de saída** (precisa alcançar a API e o Keycloak, por VPN ou HTTPS).
Se ele ficar desligado, os PDFs esperam na fila; se cair no meio, a reserva vence em 30 min.

## Preparar

1. Python 3.10+, sem pacotes extras.
2. Copie `.env.example` para `.env` nesta pasta e preencha `PIPELINE_CLIENT_SECRET`
   (Keycloak → realm `sidpb` → Clients → `sidpb-pipeline` → Credentials).
3. Encaixe a extração em `extrator.py` (função `extrair`).
4. No servidor, a API precisa de `SIDPB_EXTRACTION_MODE=pipeline` para os PDFs enviados
   aguardarem o worker (sem isso, usa a extração simulada).

## Peça uma explicação ao Antigravity

Cole no Antigravity, com esta pasta aberta:

> Leia `infra/pipeline/worker.py`, `extrator.py` e este README. Explique de forma simples, em
> português, o que o worker faz passo a passo, por que ele só precisa de conexões de saída, como
> ele garante que a extração volta para a submissão certa e o que eu preciso escrever em
> `extrator.py` para ligar os notebooks de extração que já temos.
