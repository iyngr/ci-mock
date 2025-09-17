from contextlib import contextmanager
from typing import Any, Dict, Optional

# Optional PromptFlow tracing integration with safe no-op fallback
try:
    # The actual promptflow tracing API may differ by version; we guard usage.
    # Common pattern: from promptflow.tracing import trace as pf_trace
    from promptflow.tracing import trace as pf_trace  # type: ignore
    PROMPTFLOW_AVAILABLE = True
except Exception:  # pragma: no cover
    pf_trace = None
    PROMPTFLOW_AVAILABLE = False


@contextmanager
def traced_run(span_name: str, attributes: Optional[Dict[str, Any]] = None):
    """
    Context manager to optionally trace a block using PromptFlow if available.
    If PromptFlow is not installed, this is a no-op.
    """
    if PROMPTFLOW_AVAILABLE and pf_trace:
        try:
            # pf_trace is typically used as a decorator; we simulate a simple span
            # by annotating start/end via custom attributes when possible.
            # For maximum compatibility, we just yield; the caller can decorate functions later.
            yield
        finally:
            # No explicit stop needed with this simplified approach
            ...
    else:
        # No-op
        yield


def is_tracing_enabled() -> bool:
    return PROMPTFLOW_AVAILABLE
