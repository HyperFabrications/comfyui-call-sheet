"""Your own choices for the Studio: extra options for the person traits, the scene settings and the camera.
Saved per install in ./custom_choices.json (not part of the repo).

Each choice is {id: "C1", layer, group, name, text, hex, added}:
- layer "person", group a trait key (gender, age, body, height, length, htype, hcolor, eyes, skin, complexion)
- layer "scene", group a scene category (location, time, weather, lighting, era, mood)
- layer "camera", group "cam", "flaws", "skin" or "look:<group name>"
The text is the wording that goes into the prompt. scene_data and camera_data merge these into their option lists,
so every node that reads a scene or a camera understands them. Mirrors web/choices.js.
"""

import json
import os
import re
import threading
import time

CHOICES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_choices.json")
ID_RE = re.compile(r"^C\d{1,6}$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
LAYERS = {
    "person": ("gender", "age", "body", "height", "length", "htype", "hcolor", "eyes", "skin", "complexion"),
    "scene": ("location", "time", "weather", "lighting", "era", "mood"),
    "camera": ("cam", "flaws", "skin"),
}
SENTENCES = ("lighting", "era", "mood")
NEUTRAL = "linear-gradient(135deg,#3a3b44,#6b6d7a)"
_lock = threading.Lock()


def _group_ok(layer, group):
    if layer not in LAYERS:
        return False
    if layer == "camera" and group.startswith("look:") and 5 < len(group) <= 45:
        return True
    return group in LAYERS[layer]


def _clean(x):
    layer = str(x.get("layer") or "")
    group = str(x.get("group") or "")
    name = re.sub(r"\s+", " ", str(x.get("name") or "")).strip()[:60]
    text = re.sub(r"\s+", " ", str(x.get("text") or "")).strip()
    if layer == "scene" and group in SENTENCES:
        # Lighting, era and mood go in as sentences of their own, like the built-in ones.
        text = text.rstrip(".").strip()
        text = text[:1].upper() + text[1:] + "." if text else ""
    else:
        text = text.rstrip(".").strip()
    hx = str(x.get("hex") or "")
    return layer, group, name, text, hx if HEX_RE.match(hx) else ""


def load_choices():
    """Your saved choices, oldest first."""
    try:
        with open(CHOICES_PATH, encoding="utf-8") as f:
            items = json.load(f).get("choices", [])
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for x in items if isinstance(items, list) else []:
        if not isinstance(x, dict) or not ID_RE.match(str(x.get("id", ""))):
            continue
        layer, group, name, text, hx = _clean(x)
        if _group_ok(layer, group) and name and text:
            out.append({"id": x["id"], "layer": layer, "group": group, "name": name, "text": text, "hex": hx, "added": x.get("added")})
    return out


def mtime():
    try:
        return os.path.getmtime(CHOICES_PATH)
    except OSError:
        return None


def _save(items):
    tmp = CHOICES_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"choices": items}, f, indent=2, ensure_ascii=False)
    os.replace(tmp, CHOICES_PATH)


def _next(items):
    return max([int(p["id"][1:]) for p in items] + [0]) + 1


def upsert(cid, item):
    layer, group, name, text, hx = _clean(item)
    if not _group_ok(layer, group):
        raise ValueError("That group can't take your own choices.")
    if not name:
        raise ValueError("Give it a name first.")
    if not text:
        raise ValueError("Write how it reads first.")
    with _lock:
        items = load_choices()
        hit = next((p for p in items if p["id"] == cid), None) if cid and ID_RE.match(cid) else None
        if hit:
            hit.update(name=name, text=text, hex=hx)
        else:
            hit = {"id": f"C{_next(items)}", "layer": layer, "group": group, "name": name, "text": text, "hex": hx, "added": time.strftime("%Y-%m-%d")}
            items.append(hit)
        _save(items)
    return hit


def import_many(raw):
    """Add every choice in raw as a new one. Never replaces what you already have."""
    added = 0
    with _lock:
        items = load_choices()
        n = _next(items) - 1
        for x in raw if isinstance(raw, list) else []:
            if not isinstance(x, dict):
                continue
            layer, group, name, text, hx = _clean(x)
            if not (_group_ok(layer, group) and name and text):
                continue
            n += 1
            items.append({"id": f"C{n}", "layer": layer, "group": group, "name": name, "text": text, "hex": hx, "added": time.strftime("%Y-%m-%d")})
            added += 1
        _save(items)
    return added


def remove(cid):
    with _lock:
        _save([p for p in load_choices() if p["id"] != cid])


# ---- merging into the option lists ----

def _art_medium(name):
    return name[:1].lower() + name[1:] if name else name


def merge_scenes(data, choices):
    """A copy of scenes.json's data with your scene choices added to each category."""
    mine = [c for c in choices if c["layer"] == "scene"]
    if not mine:
        return data
    cats = []
    for cat in data.get("categories", []):
        extra = [{"value": c["id"], "name": c["name"], "text": c["text"], "kind": "none", "mine": True} for c in mine if c["group"] == cat["key"]]
        cats.append({**cat, "options": list(cat["options"]) + extra} if extra else cat)
    return {**data, "categories": cats}


def merge_cameras(data, choices):
    """A copy of cameras.json's data with your cameras, flaws, skin details and looks added."""
    mine = [c for c in choices if c["layer"] == "camera"]
    if not mine:
        return data
    flaws = [{"key": c["id"], "name": c["name"], "text": c["text"], "on": False, "mine": True} for c in mine if c["group"] == "flaws"]
    cams = [{**c, "flaws": list(c.get("flaws", [])) + flaws} for c in data.get("cameras", [])]
    cams += [{"value": c["id"], "name": c["name"], "short": c["text"], "device": c["text"], "finish": "", "flaws": list(flaws), "mine": True}
             for c in mine if c["group"] == "cam"]
    skin = list(data.get("skin", [])) + [{"key": c["id"], "name": c["name"], "text": c["text"], "on": False, "mine": True} for c in mine if c["group"] == "skin"]
    looks = list(data.get("looks", []))
    for c in mine:
        if not c["group"].startswith("look:"):
            continue
        g = c["group"][5:]
        art = any(l.get("art") and l.get("group") == g for l in looks)
        look = {"value": c["id"], "name": c["name"], "short": c["text"], "group": g, "grade": c["text"], "swatch": NEUTRAL, "mine": True}
        if art:
            look.update(art=True, medium=_art_medium(c["name"]))
        looks.append(look)
    return {**data, "cameras": cams, "skin": skin, "looks": looks}


try:
    from server import PromptServer
    from aiohttp import web
    routes = PromptServer.instance.routes
except Exception:  # loaded outside ComfyUI (tests)
    routes = None

if routes is not None:

    @routes.get("/krea_pose_sheet/choices")
    async def list_choices(request):
        return web.json_response({"choices": load_choices()})

    @routes.post("/krea_pose_sheet/choices")
    async def save_choice(request):
        """Body: {id?, layer, group, name, text, hex?}. Without an id, a new choice is added."""
        body = await request.json()
        try:
            item = upsert(str(body.get("id") or ""), body)
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"ok": True, "choice": item})

    @routes.post("/krea_pose_sheet/choices/import")
    async def import_choices(request):
        """Body: an exported file ({choices: [...]}) or a plain list. Always appends."""
        try:
            body = await request.json()
        except ValueError:
            return web.json_response({"error": "That file isn't a choices export."}, status=400)
        items = body.get("choices") if isinstance(body, dict) else body
        if not isinstance(items, list):
            return web.json_response({"error": "That file isn't a choices export."}, status=400)
        added = import_many(items)
        return web.json_response({"ok": True, "added": added, "choices": load_choices()})

    @routes.delete("/krea_pose_sheet/choices/{cid}")
    async def delete_choice(request):
        cid = request.match_info["cid"]
        if ID_RE.match(cid):
            remove(cid)
        return web.json_response({"ok": True})
