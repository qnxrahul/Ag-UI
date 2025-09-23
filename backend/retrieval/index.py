# retrieval/index.py
from __future__ import annotations
from typing import List, Dict, Any, Tuple
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

class MultiDocIndex:
    """
    Simple aggregator that queries multiple DocIndex instances and returns the
    overall top-k chunks. It preserves the underlying doc_id in returned chunk ids
    by prefixing with "<doc_id>::<chunk_id>".
    """
    def __init__(self, name: str, indexes: List[Tuple[str, DocIndex]]):
        self.name = name
        self.indexes: List[Tuple[str, DocIndex]] = list(indexes)

    def top_k(self, query: str, k: int = 8) -> List[Chunk]:
        ranked: List[Tuple[float, str, Chunk]] = []
        query_tokens = query.lower().split()
        for doc_id, idx in self.indexes:
            # reuse the internal scorer to get comparable scores per index
            scores = idx.bm25.get_scores(query_tokens)
            for i, score in enumerate(scores):
                ranked.append((float(score), doc_id, idx.chunks[i]))
        ranked.sort(key=lambda x: x[0], reverse=True)

        out: List[Chunk] = []
        for _, doc_id, ch in ranked[:k]:
            # clone with composite id to keep source
            out.append(Chunk(id=f"{doc_id}::{ch.id}", text=ch.text, page=ch.page, offset=ch.offset))
        return out

    def all_chunks(self) -> List[Chunk]:
        out: List[Chunk] = []
        for doc_id, idx in self.indexes:
            for ch in idx.all_chunks():
                out.append(Chunk(id=f"{doc_id}::{ch.id}", text=ch.text, page=ch.page, offset=ch.offset))
        return out

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
