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

scenes_path = path.parent / "scenes.json"
try:
    scenes = json.loads(scenes_path.read_text(encoding="utf-8"))
    untagged = [f["id"] for f in data.get("frames", []) if f.get("id") not in scenes.get("frames", {})]
    if untagged:
        print(f"Note: {len(untagged)} frame(s) have no scene tag in scenes.json, so they keep their own location: {', '.join(untagged)}.")
        print('      Add them under "frames" with "" if the pose works anywhere, or with what the pose relies on (like "a bed").')
except (OSError, json.JSONDecodeError) as e:
    errors.append(f"scenes.json could not be read: {e}")

outfits_path = path.parent / "outfits.json"
try:
    outfits = json.loads(outfits_path.read_text(encoding="utf-8"))
    untagged = [f["id"] for f in data.get("frames", []) if f.get("id") not in outfits.get("frames", {})]
    if untagged:
        print(f"Note: {len(untagged)} frame(s) have no outfit tag in outfits.json, so they keep their own clothes: {', '.join(untagged)}.")
        print('      Add them under "frames" with "" if any outfit works, or with the garment the pose relies on (like "her coat pockets").')
    colors = {c["value"] for c in outfits.get("colors", [])}
    for c in outfits.get("categories", []):
        for o in c.get("options", []):
            if o.get("color") and o["color"] not in colors:
                errors.append(f"outfits.json: {c['key']} option \"{o.get('value')}\" uses an unknown color \"{o['color']}\".")
except (OSError, json.JSONDecodeError) as e:
    errors.append(f"outfits.json could not be read: {e}")

# Privacy: the repo is public, so no links to real people's social posts, local paths or PC names.
PRIVATE_LINK = re.compile(r"https?://(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am|facebook\.com|tiktok\.com|threads\.net|x\.com|twitter\.com|pinterest\.[a-z.]+|reddit\.com|onlyfans\.com|patreon\.com)\b", re.I)
LOCAL_BITS = re.compile(r"(?<![A-Za-z])[A-Za-z]:\\\\|/home/[a-z]|/Users/[A-Za-z]|\bDESKTOP-[A-Z0-9]{5,}\b|\b(?:ghp|gho|github_pat|sk|hf)_[A-Za-z0-9_]{16,}")
root = path.parent.parent
for f in sorted(list(root.glob("*.py")) + list(root.glob("*.toml")) + list(root.glob("*.md")) + list((root / "web").glob("*")) + list((root / "site").glob("*")) + list((root / "scripts").glob("*"))):
    if not f.is_file() or f.name == "validate.py":
        continue
    body = f.read_text(encoding="utf-8", errors="ignore")
    for rx, what in ((PRIVATE_LINK, "a link to a social media post"), (LOCAL_BITS, "a local path, PC name or key")):
        m = rx.search(body)
        if m:
            line = body.count("\n", 0, m.start()) + 1
            errors.append(f"{f.relative_to(root)} line {line}: {what} ({m.group(0)[:40]}). Keep it out of the public repo.")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"poses.json OK: {len(data['frames'])} frames in {len(tabs)} tabs, updated {data['updated']}.")
