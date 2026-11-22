"""Scenes: swap a frame's setting for one you build, or make a clean plate with nobody in it.
Mirrors web/scene_core.js; keep the two in step (tests/parity.mjs checks them)."""

import json
import os
import re

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "scenes.json")

CAM = re.compile(r"\b(shot|lens|close[- ]?up|top down|eye level|depth of field|full length|low angle|high angle|from above|from below|framing|framed)\b", re.I)
LIGHT = re.compile(r"\b(light|lights|daylight|lit|lighting|flash|glow|glowing|sunlight|sun|shadow|shadows|backlit|backlight|lamp|lamps|neon|candlelight)\b", re.I)
FINISH = re.compile(r"\b(palette|finish|grain|film|tones|contrast)\b", re.I)
WEARING = re.compile(r"^(wearing|she wears|she is wearing)\b", re.I)
PERSONAL = re.compile(r"\b(her|she|hers|herself|his|him|he|face|skin|body|subject)\b", re.I)
FRAMING = re.compile(r"\b(shot|close[- ]?up|crop|cropped|framing|framed|negative space|full length)\b", re.I)
PLATE_END = "No people anywhere in the frame."

_cache = {"mtime": None, "data": None}


def load():
    mtime = os.path.getmtime(DATA_PATH)
    if _cache["mtime"] != mtime:
        with open(DATA_PATH, encoding="utf-8") as f:
            _cache["data"] = json.load(f)
        _cache["mtime"] = mtime
    return _cache["data"]


def split(text):
    return [s.strip() for s in re.findall(r"[^.]+(?:\.|$)", text) if s.strip()]


def cap(s):
    return s[:1].upper() + s[1:] if s else s


def layout(sents):
    """Where the camera line is, which sentences describe the setting, and which is the light line."""
    c = next((i for i in range(1, len(sents)) if CAM.search(sents[i])), len(sents))
    setting = [i for i in range(1, c) if not WEARING.search(sents[i])]
    light = next((i for i in range(c + 1, len(sents)) if LIGHT.search(sents[i]) and not FINISH.search(sents[i])), -1)
    return c, setting, light


def setting_of(text):
    s = split(text)
    _, idx, _ = layout(s)
    return " ".join(s[i] for i in idx)


def light_of(text):
    s = split(text)
    _, _, li = layout(s)
    return s[li] if li >= 0 else ""


def places(frames, custom_places=()):
    """The Places prompts' settings, plus your own places."""
    name = load().get("placesSet", "Places")
    out = []
    for f in frames:
        if f.get("set") == name:
            light = light_of(f["text"])
            out.append({"id": f["id"], "title": f["title"], "bg": setting_of(f["text"]), "light": "" if PERSONAL.search(light) else light, "mine": False})
    out += [{"id": p["id"], "title": p["title"], "bg": p["bg"], "light": p.get("light", ""), "mine": True} for p in custom_places]
    return [p for p in out if p["bg"]]


def _opt(key, value):
    if not value:
        return None
    cat = next((c for c in load()["categories"] if c["key"] == key), None)
    return next((o for o in cat["options"] if o["value"] == value), None) if cat else None


def parts(state, place_list=()):
    """Turn the builder's picks into the lines that go into a prompt."""
    st = state or {}
    g = lambda k: _opt(k, st.get(k))
    place = next((p for p in place_list if p["id"] == st.get("place")), None) if st.get("place") else None
    loc, time, weather, lighting, era, mood = g("location"), g("time"), g("weather"), g("lighting"), g("era"), g("mood")
    tw = ", ".join(o["text"] for o in (time, weather) if o)
    bg = ""
    if place:
        bg = place["bg"].rstrip(" .") + (", " + tw if tw else "") + "."
    elif loc:
        bg = cap(loc["text"]) + (", " + tw if tw else "") + "."
    extra = []
    if not bg and tw:
        extra.append(cap(tw) + ".")
    extra += [o["text"] for o in (era, mood) if o]
    light = lighting["text"] if lighting else (place["light"] if place and place.get("light") else "")
    return {"bg": bg, "extra": " ".join(extra), "light": light, "plate": bool(st.get("plate")), "on": st.get("on", True) is not False,
            "label": place["title"] if place else (loc["name"] if loc else "")}


def scene_text(p):
    """The scene on its own: the setting lines, or a whole clean plate prompt."""
    if p["plate"]:
        body = " ".join(x for x in (p["bg"], p["extra"], p["light"]) if x)
        return "A photograph of an empty scene with no people." + (" " + body if body else "") + " " + PLATE_END
    return " ".join(x for x in (p["bg"], p["extra"], p["light"]) if x)


def apply(text, p):
    """Swap the frame's setting (and light line, if one was picked) for the scene's."""
    s = split(text)
    c, setting, _ = layout(s)
    if p["bg"]:
        new = p["bg"] + (" " + p["extra"] if p["extra"] else "")
        if setting:
            s[setting[0]] = new
            for i in reversed(setting[1:]):
                del s[i]
        else:
            s.insert(c, new)
    elif p["extra"]:
        s.insert(setting[-1] + 1 if setting else c, p["extra"])
    if p["light"]:
        c, _, li = layout(s)
        if li >= 0:
            s[li] = p["light"]
        else:
            s.insert(min(c + 1, len(s)), p["light"])
    return " ".join(s)


def plate(text, p=None):
    """The same frame as an empty scene: its look and camera, with nobody in it."""
    s = split(text)
    c, setting, li = layout(s)
    m = re.match(r"^\[trigger\],? (?:in )?(an? [^,]*?),", s[0]) if s else None
    lead = re.sub(r"\b(?:(?:mirror |phone )?selfie|portrait|photo shoot)\b", "photograph", m.group(1)) if m else "a photograph"
    if not re.search(r"\b(photograph|photo|shot|image|still|frame)\b", lead):
        lead += " photograph"
    out = [cap(lead) + " of an empty scene with no people."]
    if p and p["bg"]:
        out.append(p["bg"])
        if p["extra"]:
            out.append(p["extra"])
    else:
        out += [re.sub(r"\s+(?:behind|around|beside|near|under|above|over|in front of) (?:her|him)\b", "", s[i]) for i in setting]
        if p and p["extra"]:
            out.append(p["extra"])
    if c < len(s):
        keep = [x for x in re.split(r",\s*", s[c].rstrip(".")) if x and not FRAMING.search(x) and not PERSONAL.search(x)]
        if keep:
            out.append(cap(", ".join(keep)) + ".")
    light = p["light"] if p and p["light"] else (s[li] if li >= 0 else "")
    if light:
        keep = [x for x in re.split(r",\s*", light.rstrip(".")) if x and not PERSONAL.search(x)]
        if keep:
            out.append(cap(", ".join(keep)) + ".")
    out += [s[i] for i in range(c + 1, len(s)) if i != li and FINISH.search(s[i]) and not PERSONAL.search(s[i])]
    out.append(PLATE_END)
    return " ".join(out)


def locked(frame, overrides=()):
    """Location-bound frames keep their own setting unless you chose to use the scene anyway."""
    if frame["id"] in overrides:
        return False
    if frame.get("tab") == "custom":
        return not frame.get("portable")
    return load()["frames"].get(frame["id"], "x") != ""


def with_scene(frame, p, overrides=()):
    """The frame's text after the scene: swapped setting, a clean plate, or untouched."""
    if not p or not p.get("on", True):
        return frame["text"], False
    lock = locked(frame, overrides)
    if p["plate"]:
        return plate(frame["text"], None if lock else p), True
    if lock:
        return frame["text"], False
    return apply(frame["text"], p), True
