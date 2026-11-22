"""Your own places for the Scene builder. Saved per install in ./custom_places.json (not part of the repo)."""

import json
import os
import re
import threading
import time

PLACES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_places.json")
ID_RE = re.compile(r"^L\d{1,6}$")
_lock = threading.Lock()


def _clean(x):
    title = str(x.get("title") or "").strip()[:60] or "Untitled place"
    bg = re.sub(r"\s+", " ", str(x.get("bg") or "")).strip()
    light = re.sub(r"\s+", " ", str(x.get("light") or "")).strip()
    if bg and not bg.endswith("."):
        bg += "."
    if light and not light.endswith("."):
        light += "."
    return title, bg, light


def load_places():
    """Your saved places: {id: "L1", title, bg, light, added}."""
    try:
        with open(PLACES_PATH, encoding="utf-8") as f:
            items = json.load(f).get("places", [])
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for x in items:
        if isinstance(x, dict) and ID_RE.match(str(x.get("id", ""))):
            title, bg, light = _clean(x)
            if bg:
                out.append({"id": x["id"], "title": title, "bg": bg, "light": light, "added": x.get("added")})
    return out


def _save(places):
    tmp = PLACES_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"places": places}, f, indent=2, ensure_ascii=False)
    os.replace(tmp, PLACES_PATH)


def _next(places):
    return max([int(p["id"][1:]) for p in places] + [0]) + 1


def upsert(pid, item):
    title, bg, light = _clean(item)
    if not bg:
        raise ValueError("Describe the place first.")
    with _lock:
        places = load_places()
        hit = next((p for p in places if p["id"] == pid), None) if pid and ID_RE.match(pid) else None
        if hit:
            hit.update(title=title, bg=bg, light=light)
        else:
            pid = f"L{_next(places)}"
            places.append({"id": pid, "title": title, "bg": bg, "light": light, "added": time.strftime("%Y-%m-%d")})
        _save(places)
    return next(p for p in places if p["id"] == pid)


def import_many(items):
    """Add every place in items as a new one. Never replaces what you already have."""
    added = 0
    with _lock:
        places = load_places()
        n = _next(places) - 1
        for x in items if isinstance(items, list) else []:
            if not isinstance(x, dict):
                continue
            title, bg, light = _clean(x)
            if not bg:
                continue
            n += 1
            places.append({"id": f"L{n}", "title": title, "bg": bg, "light": light, "added": time.strftime("%Y-%m-%d")})
            added += 1
        _save(places)
    return added


def remove(pid):
    with _lock:
        _save([p for p in load_places() if p["id"] != pid])


try:
    from server import PromptServer
    from aiohttp import web
    routes = PromptServer.instance.routes
except Exception:  # loaded outside ComfyUI (tests)
    routes = None

if routes is not None:

    @routes.get("/krea_pose_sheet/places")
    async def list_places(request):
        return web.json_response({"places": load_places()})

    @routes.post("/krea_pose_sheet/places")
    async def save_place(request):
        """Body: {id?, title, bg, light}. Without an id, a new place is added."""
        body = await request.json()
        try:
            place = upsert(str(body.get("id") or ""), body)
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"ok": True, "place": place})

    @routes.post("/krea_pose_sheet/places/import")
    async def import_places(request):
        """Body: an exported file ({places: [...]}) or a plain list. Always appends."""
        try:
            body = await request.json()
        except ValueError:
            return web.json_response({"error": "That file isn't a places export."}, status=400)
        items = body.get("places") if isinstance(body, dict) else body
        if not isinstance(items, list):
            return web.json_response({"error": "That file isn't a places export."}, status=400)
        added = import_many(items)
        return web.json_response({"ok": True, "added": added, "places": load_places()})

    @routes.delete("/krea_pose_sheet/places/{pid}")
    async def delete_place(request):
        pid = request.match_info["pid"]
        if ID_RE.match(pid):
            remove(pid)
        return web.json_response({"ok": True})
