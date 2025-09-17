# retrieval/index.py
from __future__ import annotations
from typing import List, Dict, Any
from dataclasses import dataclass
from rank_bm25 import BM25Okapi

@dataclass
class Chunk:
    id: str
    text: str
    page: int
    offset: int

class DocIndex:
    def __init__(self, doc_id: str, chunks: List[Chunk]):
        self.doc_id = doc_id
        self.chunks = chunks
        # simple tokenization; you can swap for spaCy/regex improvements later
        tokenized = [c.text.lower().split() for c in chunks]
        self.bm25 = BM25Okapi(tokenized)
        self._tokenized = tokenized

    def top_k(self, query: str, k: int = 8) -> List[Chunk]:
        scores = self.bm25.get_scores(query.lower().split())
        # take top k indices
        idxs = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
        return [self.chunks[i] for i in idxs]

    def all_chunks(self) -> List[Chunk]:
        """Return all chunks in document order."""
        return list(self.chunks)

def chunk_text_to_paragraphs(text: str, page_map: List[int]) -> List[Chunk]:
    """
    text: full document text
    page_map: list mapping character offsets to page numbers (optional).
              If you don’t have page offsets, set page=1 for all.
    """
    chunks: List[Chunk] = []
    start = 0
    for i, block in enumerate([b for b in text.split("\n\n") if b.strip()]):
        t = block.strip()
        page = 1
        if page_map and start < len(page_map):
            page = page_map[min(start, len(page_map)-1)]
        chunks.append(Chunk(id=f"chunk_{i}", text=t, page=page, offset=start))
        start += len(block) + 2
    return chunks
