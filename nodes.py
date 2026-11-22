import json

from . import pose_data as P
from . import scene_data as S
from .custom import load_custom
from .places import load_places

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
    raise ValueError(f"Pose Sheet frame '{frame_value}' was not found. Update the node pack or pick another frame.")


class KreaPosePrompt:
    """Pick a frame from the Krea Pose Sheet and output it as a ready prompt, or a whole set as a list."""

    CATEGORY = "Krea Pose Sheet"
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
                "person": ("STRING", {"default": "", "placeholder": "person description (optional)", "tooltip": "Who is in the shot, typed here or linked from Krea Pose Person. Goes after the trigger, or replaces it if the trigger is empty."}),
                "edits": ("STRING", {"default": "", "tooltip": "Your own wording for frames, set with Edit prompt on the node. Leave empty to use the sheet's text."}),
                "scene": ("KREA_SCENE", {"tooltip": "Link a Krea Pose Scene node to swap each frame's setting, or make clean plates. Frames whose pose needs their own location keep it."}),
                "scene_overrides": ("STRING", {"default": "", "tooltip": "Frames that use the scene even though their pose relies on their own location. Set with Use scene anyway in the picker."}),
            },
        }

    def build(self, frame, mode, trigger, style, person=None, edits=None, scene=None, scene_overrides=None):
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
        try:
            overrides = json.loads(scene_overrides) if scene_overrides else []
            if not isinstance(overrides, list):
                overrides = []
        except ValueError:
            overrides = []
        prompts = []
        for x in picked:
            x = P.with_edit(x, edit_map)
            text, changed = S.with_scene(x, scene, overrides)
            if changed:
                x = {**x, "text": text, "bare": None}
            prompts.append(P.prompt_for(x, trigger, person or "", style))
        return ("\n".join(prompts), prompts, len(prompts))


class KreaPosePerson:
    """Describe who is in the shot when you have no character LoRA. Leave a trait on Any to let Krea 2 decide."""

    CATEGORY = "Krea Pose Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("person",)

    @classmethod
    def INPUT_TYPES(cls):
        req = {}
        for t in P.load()["traits"]:
            req[t["key"]] = (["Any"] + [o["name"] for o in t["options"]], {"default": "Any", "tooltip": t["label"]})
        return {"required": req}

    def build(self, **picks):
        person = {}
        for t in P.load()["traits"]:
            name = picks.get(t["key"], "Any")
            person[t["key"]] = next((o["value"] for o in t["options"] if o["name"] == name), "")
        return (P.person_text(person),)


class KreaPoseScene:
    """Build a setting (or pick a place) and link it to Krea Pose Prompt to put any portable pose there. Can also make clean plates."""

    CATEGORY = "Krea Pose Sheet"
    FUNCTION = "build"
    RETURN_TYPES = ("KREA_SCENE", "STRING")
    RETURN_NAMES = ("scene", "text")
    OUTPUT_TOOLTIPS = (
        "Link to the scene input of Krea Pose Prompt.",
        "The scene on its own: the setting lines, or a full empty scene prompt when Clean plate is on.",
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"scene": ("STRING", {"default": "{}", "tooltip": "Set with Build scene on the node."})}}

    def build(self, scene):
        try:
            state = json.loads(scene) if scene else {}
            if not isinstance(state, dict):
                state = {}
        except ValueError:
            state = {}
        p = S.parts(state, S.places(P.load()["frames"], load_places()))
        return (p, S.scene_text(p) if p["on"] else "")


NODE_CLASS_MAPPINGS = {
    "KreaPosePrompt": KreaPosePrompt,
    "KreaPosePerson": KreaPosePerson,
    "KreaPoseScene": KreaPoseScene,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "KreaPosePrompt": "Krea Pose Prompt",
    "KreaPosePerson": "Krea Pose Person",
    "KreaPoseScene": "Krea Pose Scene",
}
