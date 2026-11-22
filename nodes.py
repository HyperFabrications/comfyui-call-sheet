import json

from . import pose_data as P
from . import scene_data as S
from . import outfit_data as O
from .custom import load_custom
from .places import load_places
from .outfit_items import load_items

MODES = ["single frame", "whole set", "whole tab"]


def _frames():
    # The sheet's frames plus your own prompts from the Custom tab (read fresh, so new ones work without a restart).
    return P.load()["frames"] + load_custom()


def _frame_options():
    return [P.frame_key(f) for f in _frames()]


def _find(frame_value):
    # Match on the id before " · " so a renamed title still finds its frame.
    fid = frame_value.split(" · ", 1)[0].strip()
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
    """Pick a frame from the Call Sheet and output it as a ready prompt, or a whole set as a list."""

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
                "frame": (_frame_options(), {"tooltip": "The frame to use. In set or tab mode, this frame picks the set or tab."}),
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
            },
        }

    @classmethod
    def IS_CHANGED(cls, **kw):
        # Your own prompts live in a file, so an edit to one doesn't change the node's inputs. Hand ComfyUI
        # their current text so it runs again instead of reusing the last result.
        return json.dumps(load_custom(), sort_keys=True, ensure_ascii=False)

    def build(self, frame, mode, trigger, style, person=None, edits=None, scene=None, scene_overrides=None, outfit=None, outfit_overrides=None):
        f = _find(frame)
        try:
            edit_map = json.loads(edits) if edits else {}
            if not isinstance(edit_map, dict):
                edit_map = {}
        except ValueError:
            edit_map = {}
        if mode == "whole set":
            picked = [x for x in _frames() if x["set"] == f["set"]]
        elif mode == "whole tab":
            picked = [x for x in _frames() if x["tab"] == f["tab"]]
        else:
            picked = [f]
        overrides, wear = _ids(scene_overrides), _ids(outfit_overrides)
        prompts = []
        for x in picked:
            x = P.with_edit(x, edit_map)
            text, changed = O.with_outfit(x, outfit, wear)
            if changed:
                x = {**x, "text": text, "bare": None}
            text, changed = S.with_scene(x, scene, overrides)
            if changed:
                x = {**x, "text": text, "bare": None}
            prompts.append(P.prompt_for(x, trigger, person or "", style))
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
    """Build a setting (or pick a place) and link it to Call Sheet Pose to put any portable pose there. Can also make clean plates."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("KREA_SCENE", "STRING")
    RETURN_NAMES = ("scene", "text")
    OUTPUT_TOOLTIPS = (
        "Link to the scene input of Call Sheet Pose.",
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
    """Put together an outfit and link it to Call Sheet Pose to dress any frame in it. Swap the whole outfit or only the pieces you pick."""

    CATEGORY = "Call Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("KREA_OUTFIT", "STRING")
    RETURN_NAMES = ("outfit", "text")
    OUTPUT_TOOLTIPS = (
        "Link to the outfit input of Call Sheet Pose.",
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


NODE_CLASS_MAPPINGS = {
    "KreaPosePrompt": KreaPosePrompt,
    "KreaPosePerson": KreaPosePerson,
    "KreaPoseScene": KreaPoseScene,
    "KreaPoseOutfit": KreaPoseOutfit,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "KreaPosePrompt": "Call Sheet Pose",
    "KreaPosePerson": "Call Sheet Person",
    "KreaPoseScene": "Call Sheet Scene",
    "KreaPoseOutfit": "Call Sheet Outfit",
}
