import pytest
from constants import normalize_skill

@pytest.mark.parametrize("raw,expected", [
    ("React Hooks", "react-hooks"),
    ("  Data  Science  ", "data-science"),
    ("C++", "c"),  # non-alnum removed
    ("Node.js", "nodejs"),
    ("---Weird***Skill---", "weirdskill"),
    ("", ""),
    (None, None),
])
def test_normalize_skill(raw, expected):
    assert normalize_skill(raw) == expected
