import os
from typing import Any, Dict, Optional
import yaml

class Prompty:
    def __init__(self, name: str, system: str, model: Dict[str, Any] | None = None):
        self.name = name
        self.system = system
        self.model = model or {}


def load_prompty(path: str) -> Optional[Prompty]:
    """Load a .prompty YAML file and return a Prompty object.
    Minimal parser: we only care about 'name', 'system', and 'model'.
    Environment variables in model.* are left as-is for now; agents already read envs.
    """
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        name = data.get("name") or os.path.splitext(os.path.basename(path))[0]
        system = data.get("system", "").strip()
        model = data.get("model", {})
        return Prompty(name=name, system=system, model=model)
    except Exception as e:
        print(f"Warning: Failed to load prompty {path}: {e}")
        return None
