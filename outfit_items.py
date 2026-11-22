"""Your own clothing items for the Outfit builder. Saved per install in ./custom_outfit_items.json (not part of the repo)."""

import json
import os
import re
import threading
import time

ITEMS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_outfit_items.json")
ID_RE = re.compile(r"^I\d{1,6}$")
CATS = ("top", "bottom", "one", "outer", "shoes", "acc")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_lock = threading.Lock()


def _clean(x):
    cat = str(x.get("cat") or "")
    cat = cat if cat in CATS else "top"
    name = str(x.get("name") or "").strip()[:60] or "Untitled item"
    text = re.sub(r"\s+", " ", str(x.get("text") or "")).strip().rstrip(".").strip()
    hx = str(x.get("hex") or "")
    return cat, name, text, hx if HEX_RE.match(hx) else ""


def load_items():
    """Your saved items: {id: "I1", cat, name, text, hex, added}."""
    try:
        with open(ITEMS_PATH, encoding="utf-8") as f:
            items = json.load(f).get("items", [])
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for x in items:
        if isinstance(x, dict) and ID_RE.match(str(x.get("id", ""))):
            cat, name, text, hx = _clean(x)
            if text:
                out.append({"id": x["id"], "cat": cat, "name": name, "text": text, "hex": hx, "added": x.get("added")})
    return out


def _save(items):
    tmp = ITEMS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"items": items}, f, indent=2, ensure_ascii=False)
    os.replace(tmp, ITEMS_PATH)


def _next(items):
    return max([int(p["id"][1:]) for p in items] + [0]) + 1


def _new(n, cat, name, text, hx):
    return {"id": f"I{n}", "cat": cat, "name": name, "text": text, "hex": hx, "added": time.strftime("%Y-%m-%d")}


def upsert(iid, item):
    cat, name, text, hx = _clean(item)
    if not text:
        raise ValueError("Describe the piece first.")
    with _lock:
        items = load_items()
        hit = next((p for p in items if p["id"] == iid), None) if iid and ID_RE.match(iid) else None
        if hit:
            hit.update(cat=cat, name=name, text=text, hex=hx)
        else:
            hit = _new(_next(items), cat, name, text, hx)
            items.append(hit)
        _save(items)
    return hit


def import_many(raw):
    """Add every item in raw as a new one. Never replaces what you already have."""
    added = 0
    with _lock:
        items = load_items()
        n = _next(items) - 1
        for x in raw if isinstance(raw, list) else []:
            if not isinstance(x, dict):
                continue
            cat, name, text, hx = _clean(x)
            if not text:
                continue
            n += 1
            items.append(_new(n, cat, name, text, hx))
            added += 1
        _save(items)
    return added


def remove(iid):
    with _lock:
        _save([p for p in load_items() if p["id"] != iid])


try:
    from server import PromptServer
    from aiohttp import web
    routes = PromptServer.instance.routes
except Exception:  # loaded outside ComfyUI (tests)
    routes = None

if routes is not None:

    @routes.get("/krea_pose_sheet/outfit_items")
    async def list_items(request):
        return web.json_response({"items": load_items()})

    @routes.post("/krea_pose_sheet/outfit_items")
    async def save_item(request):
        """Body: {id?, cat, name, text, hex}. Without an id, a new item is added."""
        body = await request.json()
        try:
            item = upsert(str(body.get("id") or ""), body)
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"ok": True, "item": item})

    @routes.post("/krea_pose_sheet/outfit_items/import")
    async def import_items(request):
        """Body: an exported file ({items: [...]}) or a plain list. Always appends."""
        try:
            body = await request.json()
        except ValueError:
            return web.json_response({"error": "That file isn't a clothing export."}, status=400)
        items = body.get("items") if isinstance(body, dict) else body
        if not isinstance(items, list):
            return web.json_response({"error": "That file isn't a clothing export."}, status=400)
        added = import_many(items)
        return web.json_response({"ok": True, "added": added, "items": load_items()})

    @routes.delete("/krea_pose_sheet/outfit_items/{iid}")
    async def delete_item(request):
        iid = request.match_info["iid"]
        if ID_RE.match(iid):
            remove(iid)
        return web.json_response({"ok": True})
