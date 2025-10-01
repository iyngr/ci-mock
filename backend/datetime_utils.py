from datetime import datetime, timezone, timedelta

# India Standard Time (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> datetime:
    """Return a timezone-aware datetime in IST (UTC+5:30)."""
    return datetime.now(IST)

def now_ist_iso() -> str:
    """Return current IST time as ISO-8601 string including offset."""
    return now_ist().isoformat()
