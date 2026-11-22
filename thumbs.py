"""Preview images for frames. Saved per install in ./thumbs (not part of the repo)."""

import os
import re

from aiohttp import web

THUMB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "thumbs")
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
MAX_SIDE = 640


def _path(fid):
    return os.path.join(THUMB_DIR, f"{fid}.jpg")


try:
    from server import PromptServer
    import folder_paths
    routes = PromptServer.instance.routes
except Exception:  # loaded outside ComfyUI (tests)
    routes = None

if routes is not None:

    @routes.get("/krea_pose_sheet/thumbs")
    async def list_thumbs(request):
        out = {}
        if os.path.isdir(THUMB_DIR):
            for name in os.listdir(THUMB_DIR):
                fid, ext = os.path.splitext(name)
                if ext == ".jpg" and SAFE_ID.match(fid):
                    out[fid] = f"/krea_pose_sheet/thumb/{fid}?v={int(os.path.getmtime(_path(fid)))}"
        return web.json_response(out)

    @routes.get("/krea_pose_sheet/thumb/{fid}")
    async def get_thumb(request):
        fid = request.match_info["fid"]
        if not SAFE_ID.match(fid) or not os.path.isfile(_path(fid)):
            return web.Response(status=404)
        return web.FileResponse(_path(fid), headers={"Cache-Control": "max-age=31536000"})

    @routes.post("/krea_pose_sheet/thumb/{fid}")
    async def set_thumb(request):
        """Body: {filename, subfolder, type} of an image ComfyUI already saved or previewed."""
        from PIL import Image
        fid = request.match_info["fid"]
        if not SAFE_ID.match(fid):
            return web.json_response({"error": "bad frame id"}, status=400)
        body = await request.json()
        base = folder_paths.get_directory_by_type(body.get("type") or "output")
        if base is None:
            return web.json_response({"error": "bad image type"}, status=400)
        src = os.path.abspath(os.path.join(base, body.get("subfolder") or "", body.get("filename") or ""))
        if os.path.commonpath([src, os.path.abspath(base)]) != os.path.abspath(base) or not os.path.isfile(src):
            return web.json_response({"error": "image not found"}, status=404)
        os.makedirs(THUMB_DIR, exist_ok=True)
        with Image.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            im.save(_path(fid), "JPEG", quality=86)
        return web.json_response({"ok": True, "url": f"/krea_pose_sheet/thumb/{fid}?v={int(os.path.getmtime(_path(fid)))}"})

    @routes.delete("/krea_pose_sheet/thumb/{fid}")
    async def delete_thumb(request):
        fid = request.match_info["fid"]
        if SAFE_ID.match(fid) and os.path.isfile(_path(fid)):
            os.remove(_path(fid))
        return web.json_response({"ok": True})
