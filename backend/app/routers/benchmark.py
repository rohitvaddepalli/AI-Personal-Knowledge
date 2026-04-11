"""
Stress testing and performance benchmarking endpoints.

Benchmarks:
- Database query performance for large note counts
- Embedding query performance (ChromaDB)  
- API response time monitoring
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import time
from app.database import get_db
from app.models.note import Note as NoteModel

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])


class BenchmarkResult(BaseModel):
    name: str
    duration_ms: float
    record_count: int
    throughput: float  # records per second
    status: str = "ok"
    error: str | None = None


class BenchmarkSuiteResult(BaseModel):
    results: list[BenchmarkResult]
    total_ms: float
    summary: str


@router.get("/notes-query")
def benchmark_notes_query(db: Session = Depends(get_db)) -> BenchmarkResult:
    """Benchmark the main notes query (used by NoteList)."""
    start = time.perf_counter()
    notes = db.query(NoteModel).filter(
        NoteModel.is_archived == False,
        NoteModel.deleted_at == None
    ).order_by(NoteModel.created_at.desc()).limit(100).all()
    elapsed = (time.perf_counter() - start) * 1000
    count = len(notes)
    return BenchmarkResult(
        name="notes-query-top100",
        duration_ms=round(elapsed, 2),
        record_count=count,
        throughput=round(count / (elapsed / 1000), 1) if elapsed > 0 else 0,
    )


@router.get("/notes-count")
def benchmark_notes_count(db: Session = Depends(get_db)) -> dict:
    """Get total note count — useful for understanding database size."""
    total = db.query(NoteModel).count()
    active = db.query(NoteModel).filter(
        NoteModel.is_archived == False,
        NoteModel.deleted_at == None
    ).count()
    trashed = db.query(NoteModel).filter(NoteModel.deleted_at != None).count()
    return {
        "total": total,
        "active": active,
        "trashed": trashed,
        "archived": total - active - trashed,
    }


@router.get("/search-fts")
def benchmark_fts_search(query: str = "test", db: Session = Depends(get_db)) -> BenchmarkResult:
    """Benchmark FTS5 full-text search performance."""
    from sqlalchemy import text
    start = time.perf_counter()
    try:
        results = db.execute(
            text("SELECT id, title FROM notes_fts WHERE notes_fts MATCH :q LIMIT 20"),
            {"q": query}
        ).fetchall()
        elapsed = (time.perf_counter() - start) * 1000
        return BenchmarkResult(
            name="fts5-search",
            duration_ms=round(elapsed, 2),
            record_count=len(results),
            throughput=round(len(results) / (elapsed / 1000), 1) if elapsed > 0 else 0,
        )
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return BenchmarkResult(
            name="fts5-search",
            duration_ms=round(elapsed, 2),
            record_count=0,
            throughput=0,
            status="error",
            error=str(e)
        )


@router.get("/embedding-search")
def benchmark_embedding_search(query: str = "knowledge management") -> BenchmarkResult:
    """Benchmark ChromaDB vector search performance."""
    from app.services.embedding_service import search_similar_notes
    start = time.perf_counter()
    try:
        results = search_similar_notes(query, n_results=10)
        elapsed = (time.perf_counter() - start) * 1000
        count = len(results) if results else 0
        return BenchmarkResult(
            name="chromadb-vector-search",
            duration_ms=round(elapsed, 2),
            record_count=count,
            throughput=round(count / (elapsed / 1000), 1) if elapsed > 0 else 0,
        )
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return BenchmarkResult(
            name="chromadb-vector-search",
            duration_ms=round(elapsed, 2),
            record_count=0,
            throughput=0,
            status="error",
            error=str(e)
        )


@router.get("/suite")
def run_benchmark_suite(db: Session = Depends(get_db)) -> BenchmarkSuiteResult:
    """Run all benchmarks and return a comprehensive report."""
    suite_start = time.perf_counter()
    
    results = [
        benchmark_notes_query(db),
        benchmark_fts_search(db=db),
        benchmark_embedding_search(),
    ]

    total = (time.perf_counter() - suite_start) * 1000
    
    fast = sum(1 for r in results if r.duration_ms < 50)
    slow = sum(1 for r in results if r.status == "ok" and r.duration_ms >= 200)
    errors = sum(1 for r in results if r.status == "error")
    
    summary_parts = [f"{len(results)} benchmarks run"]
    if errors:
        summary_parts.append(f"{errors} errors (check ChromaDB/FTS setup)")
    if slow:
        summary_parts.append(f"{slow} slow queries (>200ms) — consider optimization")
    else:
        summary_parts.append("all queries within acceptable range")
    
    return BenchmarkSuiteResult(
        results=results,
        total_ms=round(total, 2),
        summary=". ".join(summary_parts)
    )
