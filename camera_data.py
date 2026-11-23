"""Cameras: make a frame read like it came from a real device, with that device's flaws, and optionally real skin.
Mirrors web/camera_core.js; keep the two in step (tests/camera_parity.mjs checks them)."""

import json
import os
import re

try:
    from .scene_data import split
except ImportError:  # run as a plain module (tests)
    from scene_data import split

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "cameras.json")

CAM = re.compile(r"\b(shot|lens|close[- ]?up|top down|eye level|depth of field|full length|low angle|high angle|from above|from below|framing|framed)\b", re.I)
LENS = re.compile(r"\b(\d+\s?mm|lens|phone camera look|deep focus|depth of field|background blur|focus falloff|bokeh)\b", re.I)
FIN = re.compile(r"\b(grain|grainy|film|finish|grade|grading|matte|print border)\b", re.I)
FLASH = re.compile(r"\bflash\b", re.I)

_cache = {"mtime": None, "data": None}


def load():
    mtime = os.path.getmtime(DATA_PATH)
    if _cache["mtime"] != mtime:
        with open(DATA_PATH, encoding="utf-8") as f:
            _cache["data"] = json.load(f)
        _cache["mtime"] = mtime
    return _cache["data"]


def _cap(s):
    return s[:1].upper() + s[1:] if s else s


def _low(s):
    return s[0].lower() + s[1:] if s and re.match(r"^[A-Z][a-z]", s) else s


def _list(a):
    return ", ".join(a[:-1]) + " and " + a[-1] if len(a) > 1 else (a[0] if a else "")


def _pick(items, chosen):
    chosen = chosen if isinstance(chosen, dict) else {}
    return [o for o in items if (chosen[o["key"]] if isinstance(chosen.get(o["key"]), bool) else o["on"])]


def camera_of(value):
    return next((c for c in load()["cameras"] if c["value"] == value), None) if value else None


def parts(state):
    """Turn the node's picks into what goes into a prompt."""
    st = state or {}
    c = camera_of(st.get("cam"))
    flaws = [o["text"] for o in _pick(c["flaws"], st.get("flaws"))] if c else []
    skin = bool(st.get("skin"))
    bits = [o["text"] for o in _pick(load()["skin"], st.get("skinBits"))] if skin else []
    return {
        "on": st.get("on") is not False, "cam": c["value"] if c else "", "label": c["name"] if c else "",
        "device": c["device"] if c else "", "keepLens": bool(c and c.get("keepLens")), "light": (c.get("light") or "") if c else "",
        "finish": c["finish"] if c else "",
        "flaws": _cap(_list(flaws)) + "." if flaws else "",
        "skin": (f"Natural unretouched skin with {_list(bits)}." if bits else "Natural unretouched skin.") if skin else "",
    }


def camera_text(p):
    if not p["on"]:
        return ""
    return " ".join(x for x in [_cap(p["device"]) + "." if p["device"] else "", p["light"], _cap(p["finish"]) + "." if p["finish"] else "", p["flaws"], p["skin"]] if x)


def _bits(s):
    return [b for b in re.split(r",\s*", re.sub(r"\.+$", "", s)) if b]


def apply(text, p):
    s = split(text)
    if p["cam"]:
        c = next((i for i in range(1, len(s)) if CAM.search(s[i])), -1)
        if c < 0:
            s.append(_cap(p["device"]) + ".")
            c = len(s) - 1
        else:
            bits = _bits(s[c])
            at = next((i for i, b in enumerate(bits) if LENS.search(b)), len(bits))
            if p["keepLens"]:
                kept = [re.sub(r"^shot on (\d+\s?mm)$", r"\1 lens", b, flags=re.I) for b in bits]
            else:
                kept = [b for b in bits if not LENS.search(b)]
                at = len([b for b in bits[:at] if not LENS.search(b)])
            if at == 0 and kept:
                kept[0] = _low(kept[0])
            kept.insert(at, p["device"])
            s[c] = _cap(", ".join(kept)) + "."
        start = c + 1
        if p["light"] and not any(FLASH.search(x) for x in s[c + 1:]):
            s.insert(c + 1, p["light"])
            start = c + 2
        done = False
        i = start
        while i < len(s):
            bits = _bits(s[i])
            at = next((j for j, b in enumerate(bits) if FIN.search(b)), -1)
            if at < 0:
                i += 1
                continue
            kept = [b for b in bits if not FIN.search(b)]
            if not done:
                kept.insert(len([b for b in bits[:at] if not FIN.search(b)]), p["finish"])
                done = True
            if kept:
                s[i] = _cap(", ".join(kept)) + "."
                i += 1
            else:
                s.pop(i)
        if not done:
            s.append(_cap(p["finish"]) + ".")
        if p["flaws"]:
            s.append(p["flaws"])
    if p["skin"]:
        s.append(p["skin"])
    return " ".join(s)


def with_camera(text, p):
    """The prompt after the camera. Returns (text, changed)."""
    if not p or not p.get("on") or (not p.get("cam") and not p.get("skin")):
        return text, False
    return apply(text, p), True
