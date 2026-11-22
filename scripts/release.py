"""Stamp a new release: sets "updated", adds a What's new line and bumps the version.

Usage: python scripts/release.py "Added six new window light poses."
Commit and push afterwards. The version change makes GitHub publish to the Comfy Registry.
"""
import datetime
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
if len(sys.argv) < 2 or not sys.argv[1].strip():
    sys.exit('Give a short note for What\'s new, e.g. python scripts/release.py "Added six new poses."')
note = sys.argv[1].strip()
today = datetime.date.today().isoformat()

data_path = root / "web" / "poses.json"
data = json.loads(data_path.read_text(encoding="utf-8"))
data["updated"] = today
data["changelog"].insert(0, {"date": today, "text": note})
data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

py = root / "pyproject.toml"
text = py.read_text(encoding="utf-8")
m = re.search(r'^version = "(\d+)\.(\d+)\.(\d+)"', text, re.M)
new = f"{m.group(1)}.{int(m.group(2)) + 1}.0"
py.write_text(text[:m.start()] + f'version = "{new}"' + text[m.end():], encoding="utf-8")
print(f"Version {new}, updated {today}: {note}")
