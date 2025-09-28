import logging
from fastapi import HTTPException
from typing import Optional

logger = logging.getLogger(__name__)


def safe_raise_http(user_message: str, exc: Optional[Exception] = None, status_code: int = 500) -> None:
    """
    Log the full exception server-side and raise a generic HTTPException for clients.

    - user_message: short, non-sensitive message returned to client
    - exc: optional exception instance; full details are logged with stack trace
    - status_code: HTTP status code to raise
    """
    if exc is not None:
        logger.exception("%s: %s", user_message, exc)
    else:
        logger.error(user_message)
    raise HTTPException(status_code=status_code, detail=user_message)


def safe_log(user_message: str, exc: Optional[Exception] = None) -> None:
    """
    Log exceptions safely on the server. Prefer logger.exception to capture stack traces.
    """
    if exc is not None:
        logger.exception("%s: %s", user_message, exc)
    else:
        logger.error(user_message)
