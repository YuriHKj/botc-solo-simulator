from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

from scripts.pipeline_utils import iter_jsonl, tokenize


@dataclass
class RetrievedExample:
    score: float
    record: Dict[str, Any]


class SimpleRetriever:
    def __init__(self, corpus_paths: List[Path]) -> None:
        self.records: List[Dict[str, Any]] = []
        self.index_tokens: List[set[str]] = []
        for path in corpus_paths:
            for rec in iter_jsonl(path):
                text = str(rec.get("text", ""))
                tok = set(tokenize(text))
                if not tok:
                    continue
                self.records.append(rec)
                self.index_tokens.append(tok)

    def retrieve(self, query_text: str, top_k: int = 5, filters: Dict[str, Any] | None = None) -> List[RetrievedExample]:
        filters = filters or {}
        qtok = set(tokenize(query_text))
        if not qtok:
            qtok = {"_empty_"}
        scored: List[RetrievedExample] = []

        for rec, rtok in zip(self.records, self.index_tokens):
            if not self._match_filters(rec, filters):
                continue
            inter = len(qtok & rtok)
            union = len(qtok | rtok)
            score = (inter / union) if union else 0.0
            if score <= 0:
                continue
            scored.append(RetrievedExample(score=score, record=rec))

        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]

    @staticmethod
    def _match_filters(record: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        for k, v in filters.items():
            if v is None:
                continue
            if record.get(k) != v:
                return False
        return True
