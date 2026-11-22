"""Check web/poses.json for mistakes that would break the sheet or the node. Run: python scripts/validate.py"""
import json
import re
import sys
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "web" / "poses.json"
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except json.JSONDecodeError as e:
    sys.exit(f"poses.json is not valid JSON: line {e.lineno}, column {e.colno}: {e.msg}. Often a missing comma or quote.")

errors = []
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
tabs = {t["id"]: t for t in data.get("tabs", [])}
set_tab = {s: t["id"] for t in data["tabs"] for s in t["sets"]}
for s in set_tab:
    if s not in data.get("sets", {}):
        errors.append(f"Set '{s}' has no label in \"sets\".")
if not DATE.match(data.get("updated", "")):
    errors.append('"updated" must be a date like 2026-11-21.')
seen = set()
for i, f in enumerate(data.get("frames", [])):
    where = f"Frame {f.get('id', '#' + str(i + 1))}"
    for k in ("id", "tab", "set", "title", "text"):
        if not isinstance(f.get(k), str) or not f.get(k).strip():
            errors.append(f"{where}: missing \"{k}\".")
    if f.get("id") in seen:
        errors.append(f"{where}: the id is used twice.")
    seen.add(f.get("id"))
    if f.get("tab") not in tabs:
        errors.append(f"{where}: tab '{f.get('tab')}' is not one of {', '.join(tabs)}.")
    elif set_tab.get(f.get("set")) != f.get("tab"):
        errors.append(f"{where}: set '{f.get('set')}' is not listed under tab '{f.get('tab')}'.")
    if "[trigger]" not in f.get("text", ""):
        errors.append(f"{where}: the prompt has no [trigger].")
    if " · " in f.get("title", ""):
        errors.append(f"{where}: titles can't contain ' · '.")
    for k in ("added", "upd"):
        if k in f and not DATE.match(f[k]):
            errors.append(f"{where}: \"{k}\" must be a date like 2026-11-21.")
for c in data.get("changelog", []):
    if not DATE.match(c.get("date", "")) or not c.get("text"):
        errors.append("Each changelog entry needs a date and text.")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"poses.json OK: {len(data['frames'])} frames in {len(tabs)} tabs, updated {data['updated']}.")
