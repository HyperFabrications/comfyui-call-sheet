import json

from . import pose_data as P
from . import scene_data as S
from . import outfit_data as O
from . import camera_data as C
from .custom import load_custom
from .places import load_places
from .outfit_items import load_items
from .choices import load_choices

MODES = ["single frame", "whole set", "whole tab"]


def _frames():
    # The sheet's frames plus your own prompts from the Custom tab (read fresh, so new ones work without a restart).
    return P.load()["frames"] + load_custom()


def _frame_options():
    return [P.frame_key(f) for f in _frames()]


def _default_frame():
    """New nodes start on the first SFW frame."""
    f = next((f for f in _frames() if f.get("tab") == "sfw"), None)
    return P.frame_key(f) if f else _frame_options()[0]


# Frames that moved to another tab get a new id. Saved workflows still find them by the old one.
MOVED = {"S441": "100", "S442": "101"}


def _find(frame_value):
    # Match on the id before " · " so a renamed title still finds its frame.
    fid = frame_value.split(" · ", 1)[0].strip()
    fid = MOVED.get(fid, fid)
    for f in _frames():
        if f["id"] == fid:
            return f
    raise ValueError(f"Call Sheet frame '{frame_value}' was not found. Update the node pack or pick another frame.")


def _ids(raw):
    try:
        v = json.loads(raw) if raw else []
    except ValueError:
        return []
    return v if isinstance(v, list) else []


def _state(raw):
    try:
        v = json.loads(raw) if raw else {}
    except ValueError:
        return {}
    return v if isinstance(v, dict) else {}


class KreaPosePrompt:
    """Pick a starting shot from the Call Sheet and output it as a prompt to build on, or a whole set as a list."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("STRING", "STRING", "INT")
    RETURN_NAMES = ("prompt", "prompt_list", "count")
    OUTPUT_IS_LIST = (False, True, False)
    OUTPUT_TOOLTIPS = (
        "The chosen prompt. For a whole set or tab, every prompt one per line, like Copy set.",
        "The same prompts as a list, so the rest of the graph runs once per prompt.",
        "How many prompts were output.",
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frame": (_frame_options(), {"default": _default_frame(), "tooltip": "The frame to use. In set or tab mode, this frame picks the set or tab."}),
                "mode": (MODES, {"default": "single frame"}),
                "trigger": ("STRING", {"default": "", "placeholder": "LoRA trigger (leave empty for none)", "tooltip": "Replaces [trigger] in every prompt."}),
                "style": ("BOOLEAN", {"default": True, "label_on": "style on", "label_off": "style off",
                                      "tooltip": "Off strips medium, film, grain and palette words so a LoRA supplies the look."}),
            },
            "optional": {
                "person": ("STRING", {"default": "", "placeholder": "person description (optional)", "tooltip": "Who is in the shot, typed here or linked from Call Sheet Person. Goes after the trigger, or replaces it if the trigger is empty."}),
                "edits": ("STRING", {"default": "", "tooltip": "Your own wording for frames, set with Edit prompt on the node. Leave empty to use the sheet's text."}),
                "scene": ("KREA_SCENE", {"tooltip": "Link a Call Sheet Scene node to swap each frame's setting, or make clean plates. Frames whose pose needs their own location keep it."}),
                "scene_overrides": ("STRING", {"default": "", "tooltip": "Frames that use the scene even though their pose relies on their own location. Set with Use scene anyway in the picker."}),
                "outfit": ("KREA_OUTFIT", {"tooltip": "Link a Call Sheet Outfit node to change what she wears. Frames whose pose relies on a garment keep their own clothes."}),
                "outfit_overrides": ("STRING", {"default": "", "tooltip": "Frames that use the outfit even though their pose relies on a garment. Set with Use outfit anyway in the picker."}),
                "camera": ("KREA_CAMERA", {"tooltip": "Link a Call Sheet Camera node to shoot every frame on a phone, flash, disposable or film camera, with its flaws and real skin."}),
            },
        }

    @classmethod
    def IS_CHANGED(cls, **kw):
        # Your own prompts live in a file, so an edit to one doesn't change the node's inputs. Hand ComfyUI
        # their current text so it runs again instead of reusing the last result.
        return json.dumps(load_custom(), sort_keys=True, ensure_ascii=False)

    def build(self, frame, mode, trigger, style, person=None, edits=None, scene=None, scene_overrides=None, outfit=None, outfit_overrides=None, camera=None):
        try:
            edit_map = json.loads(edits) if edits else {}
            if not isinstance(edit_map, dict):
                edit_map = {}
        except ValueError:
            edit_map = {}
        return _build(frame, mode, trigger, style, person or "", edit_map, scene, _ids(scene_overrides), outfit, _ids(outfit_overrides), camera)


def _build(frame, mode, trigger, style, person, edit_map, scene, overrides, outfit, wear, camera):
    """The prompts for a frame (or its set or tab), with the outfit, scene, person and camera applied."""
    f = _find(frame)
    if mode == "whole set":
        picked = [x for x in _frames() if x["set"] == f["set"]]
    elif mode == "whole tab":
        picked = [x for x in _frames() if x["tab"] == f["tab"]]
    else:
        picked = [f]
    prompts = []
    for x in picked:
        x = P.with_edit(x, edit_map)
        text, changed = O.with_outfit(x, outfit, wear)
        if changed:
            x = {**x, "text": text, "bare": None}
        text, changed = S.with_scene(x, scene, overrides)
        if changed:
            x = {**x, "text": text, "bare": None}
        prompts.append(P.prompt_for(x, trigger, person or "", style, camera=camera))
    return ("\n".join(prompts), prompts, len(prompts))


class KreaPosePerson:
    """Describe who is in the shot when you have no character LoRA. Leave a trait on Any to let Krea 2 decide."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("person",)

    @classmethod
    def INPUT_TYPES(cls):
        req = {}
        for t in P.load()["traits"]:
            req[t["key"]] = (["Any"] + [o["name"] for o in t["options"]], {"default": "Any", "tooltip": t["label"]})
        return {
            "required": req,
            "optional": {"wording": ("STRING", {"default": "", "tooltip": "Your own wording for the person, set in the person builder. Leave empty to build it from the picks."})},
        }

    def build(self, wording="", **picks):
        if wording and wording.strip():
            return (wording.strip(),)
        person = {}
        for t in P.load()["traits"]:
            name = picks.get(t["key"], "Any")
            person[t["key"]] = next((o["value"] for o in t["options"] if o["name"] == name), "")
        return (P.person_text(person),)


class KreaPoseScene:
    """Build a setting (or pick a place) and link it to Call Sheet Shot to put any portable pose there. Can also make clean plates."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("KREA_SCENE", "STRING")
    RETURN_NAMES = ("scene", "text")
    OUTPUT_TOOLTIPS = (
        "Link to the scene input of Call Sheet Shot.",
        "The scene on its own: the setting lines, or a full empty scene prompt when Clean plate is on.",
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"scene": ("STRING", {"default": "{}", "tooltip": "Set with Build scene on the node."})}}

    @classmethod
    def IS_CHANGED(cls, scene="{}", **kw):
        # Your places live in a file, so key the cache on the finished scene, not only the widget.
        return json.dumps(S.parts(_state(scene), S.places(P.load()["frames"], load_places())), sort_keys=True, ensure_ascii=False)

    def build(self, scene):
        p = S.parts(_state(scene), S.places(P.load()["frames"], load_places()))
        return (p, S.scene_text(p) if p["on"] else "")


class KreaPoseOutfit:
    """Put together an outfit and link it to Call Sheet Shot to dress any frame in it. Swap the whole outfit or only the pieces you pick."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("KREA_OUTFIT", "STRING")
    RETURN_NAMES = ("outfit", "text")
    OUTPUT_TOOLTIPS = (
        "Link to the outfit input of Call Sheet Shot.",
        "The outfit on its own, as a Wearing sentence.",
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"outfit": ("STRING", {"default": "{}", "tooltip": "Set with Build outfit on the node."})}}

    @classmethod
    def IS_CHANGED(cls, outfit="{}", **kw):
        # Your items live in a file, so editing one leaves the widget the same. Key the cache on the finished outfit.
        return json.dumps(O.parts(_state(outfit), load_items()), sort_keys=True, ensure_ascii=False)

    def build(self, outfit):
        p = O.parts(_state(outfit), load_items())
        return (p, O.outfit_text(p) if p["on"] else "")


class KreaPoseCamera:
    """Pick the camera the shot was taken on: a phone, a flash, a disposable or film. Each adds its own flaws, and you can add real skin."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("KREA_CAMERA", "STRING")
    RETURN_NAMES = ("camera", "text")
    OUTPUT_TOOLTIPS = (
        "Link to the camera input of Call Sheet Shot.",
        "The camera on its own: the lines it adds to a prompt.",
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"camera": ("STRING", {"default": "{}", "tooltip": "Set with Pick camera on the node."})}}

    def build(self, camera):
        p = C.parts(_state(camera))
        return (p, C.camera_text(p))


class KreaCallSheet:
    """The whole shot on one node: a frame plus the person, outfit, scene and camera, all set in the Studio.
    Link a Person, Outfit, Scene or Camera node to take over that part."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("STRING", "STRING", "INT")
    RETURN_NAMES = ("prompt", "prompt_list", "count")
    OUTPUT_IS_LIST = (False, True, False)
    OUTPUT_TOOLTIPS = KreaPosePrompt.OUTPUT_TOOLTIPS

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frame": (_frame_options(), {"default": _default_frame(), "tooltip": "The frame to use. In set or tab mode, this frame picks the set or tab."}),
                "mode": (MODES, {"default": "single frame"}),
                "trigger": ("STRING", {"default": "", "placeholder": "LoRA trigger (leave empty for none)", "tooltip": "Replaces [trigger] in every prompt."}),
                "style": ("BOOLEAN", {"default": True, "label_on": "style on", "label_off": "style off",
                                      "tooltip": "Off strips medium, film, grain and palette words so a LoRA supplies the look."}),
            },
            "optional": {
                "studio": ("STRING", {"default": "{}", "tooltip": "Everything set in the Studio: person, outfit, scene, camera and your prompt edits."}),
                "person": ("STRING", {"forceInput": True, "tooltip": "Link a Call Sheet Person node to describe who is in the shot instead of the Person tab."}),
                "outfit": ("KREA_OUTFIT", {"tooltip": "Link a Call Sheet Outfit node to use it instead of the Outfit tab."}),
                "scene": ("KREA_SCENE", {"tooltip": "Link a Call Sheet Scene node to use it instead of the Scene tab."}),
                "camera": ("KREA_CAMERA", {"tooltip": "Link a Call Sheet Camera node to use it instead of the Camera tab."}),
            },
        }

    @classmethod
    def IS_CHANGED(cls, **kw):
        # Your prompts, items, places and choices live in files, so an edit to one doesn't change the node's inputs.
        return json.dumps([load_custom(), load_items(), load_places(), load_choices()], sort_keys=True, ensure_ascii=False)

    def build(self, frame, mode, trigger, style, studio="{}", person=None, outfit=None, scene=None, camera=None):
        st = _state(studio)
        if person is None:
            ps = st.get("person") if isinstance(st.get("person"), dict) else {}
            person = ""
            if ps.get("on") is not False:
                picks = ps.get("picks") if isinstance(ps.get("picks"), dict) else {}
                picks = {k: str(v) for k, v in picks.items() if isinstance(v, str) and v}
                person = str(ps.get("text") or "").strip() or P.person_text(picks)
        if outfit is None and isinstance(st.get("outfit"), dict):
            outfit = O.parts(st["outfit"], load_items())
        if scene is None and isinstance(st.get("scene"), dict):
            p = S.parts(st["scene"], S.places(P.load()["frames"], load_places()))
            scene = p if (p["bg"] or p["extra"] or p["light"] or p["plate"]) else None
        if camera is None and isinstance(st.get("camera"), dict):
            camera = C.parts(st["camera"])
        edits = st.get("edits") if isinstance(st.get("edits"), dict) else {}
        return _build(frame, mode, trigger, style, person, edits, scene, _ids(json.dumps(st.get("sceneOverrides") or [])),
                      outfit, _ids(json.dumps(st.get("outfitOverrides") or [])), camera)


NODE_CLASS_MAPPINGS = {
    "KreaCallSheet": KreaCallSheet,
    "KreaPosePrompt": KreaPosePrompt,
    "KreaPosePerson": KreaPosePerson,
    "KreaPoseScene": KreaPoseScene,
    "KreaPoseOutfit": KreaPoseOutfit,
    "KreaPoseCamera": KreaPoseCamera,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "KreaCallSheet": "Call Sheet",
    "KreaPosePrompt": "Call Sheet Shot",
    "KreaPosePerson": "Call Sheet Person",
    "KreaPoseScene": "Call Sheet Scene",
    "KreaPoseOutfit": "Call Sheet Outfit",
    "KreaPoseCamera": "Call Sheet Camera",
}
