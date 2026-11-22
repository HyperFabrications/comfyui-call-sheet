"""Your own prompts (the Custom tab). Saved per install in ./custom_prompts.json (not part of the repo)."""

import json
import os
import re
import threading
import time

CUSTOM_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_prompts.json")
CUSTOM_TAB = {"id": "custom", "name": "Custom", "sets": ["custom"]}
CUSTOM_SET_NAME = "Your prompts"
ID_RE = re.compile(r"^U\d{1,6}$")
_lock = threading.Lock()


def load_custom():
    """Your saved prompts as frames: {id: "U1", tab: "custom", set: "custom", title, text}."""
    try:
        with open(CUSTOM_PATH, encoding="utf-8") as f:
            items = json.load(f).get("frames", [])
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for x in items:
        if isinstance(x, dict) and ID_RE.match(str(x.get("id", ""))) and str(x.get("text", "")).strip():
            out.append({"id": x["id"], "tab": "custom", "set": "custom", "title": str(x.get("title") or "Untitled").strip()[:80],
                        "text": str(x["text"]), "added": x.get("added")})
    return out


def _save(frames):
    tmp = CUSTOM_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"frames": frames}, f, indent=2, ensure_ascii=False)
    os.replace(tmp, CUSTOM_PATH)


def upsert(fid, title, text):
    text = str(text or "").strip()
    if not text:
        raise ValueError("The prompt is empty.")
    title = str(title or "").strip()[:80] or "Untitled"
    with _lock:
        frames = load_custom()
        if fid and ID_RE.match(fid):
            for f in frames:
                if f["id"] == fid:
                    f["title"], f["text"] = title, text
                    break
            else:
                frames.append({"id": fid, "tab": "custom", "set": "custom", "title": title, "text": text, "added": time.strftime("%Y-%m-%d")})
        else:
            n = max([int(f["id"][1:]) for f in frames] + [0]) + 1
            fid = f"U{n}"
            frames.append({"id": fid, "tab": "custom", "set": "custom", "title": title, "text": text, "added": time.strftime("%Y-%m-%d")})
        _save(frames)
    return next(f for f in frames if f["id"] == fid)


def remove(fid):
    with _lock:
        frames = [f for f in load_custom() if f["id"] != fid]
        _save(frames)


try:
    from server import PromptServer
    from aiohttp import web
    routes = PromptServer.instance.routes
except Exception:  # loaded outside ComfyUI (tests)
    routes = None

if routes is not None:

    @routes.get("/krea_pose_sheet/custom")
    async def list_custom(request):
        return web.json_response({"tab": CUSTOM_TAB, "setName": CUSTOM_SET_NAME, "frames": load_custom()})

    @routes.post("/krea_pose_sheet/custom")
    async def save_custom(request):
        """Body: {id?, title, text}. Without an id, a new prompt is added."""
        body = await request.json()
        try:
            frame = upsert(str(body.get("id") or ""), body.get("title"), body.get("text"))
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"ok": True, "frame": frame})

    @routes.delete("/krea_pose_sheet/custom/{fid}")
    async def delete_custom(request):
        fid = request.match_info["fid"]
        if ID_RE.match(fid):
            remove(fid)
        return web.json_response({"ok": True})
