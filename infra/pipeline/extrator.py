"""Ponto de encaixe da extração: a ÚNICA parte que a equipe precisa adaptar.

extrair() recebe o caminho de um PDF e devolve o JSON da extração no mesmo formato que os notebooks
já produzem (campo "sumarization" dos .jsonl): {"source": {...}, "occurrences": [...]}.
Pode devolver um dict ou o texto JSON. Se a LLM devolver JSON quebrado, envie mesmo assim: o SIDPB
recupera o que der e o curador completa lendo a fonte.
"""
from pathlib import Path

MODELO = "Qwen/Qwen3.5-9B"


def extrair(pdf: Path, titulo: str | None = None):
    # Exemplo: chamar a mesma função usada em sumarization_qwen_jsonl_v3.ipynb.
    #   texto = converter_pdf(pdf)              # docling/grobid, como em resultsmark/
    #   return rodar_llm(texto)                 # devolve o JSON da extração
    raise NotImplementedError(
        "Encaixe a extração em infra/pipeline/extrator.py (função extrair)."
    )
