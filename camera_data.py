"""Cameras and looks: make a frame read like it came from a real device with that device's flaws, give it a look
(a film stock, a grade, a kind of light) or turn it into art, and optionally add real skin.
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
LIGHTW = re.compile(r"\b(light|lights|daylight|lit|lighting|flash|glow|glowing|sunlight|sun|shadow|shadows|backlit|backlight|lamp|lamps|neon|candlelight|highlights|overcast|sky|rim)\b", re.I)
PAL = re.compile(r"\b(palette|tones|colou?rs?|monochrome|black and white|sepia)\b", re.I)
REAL = re.compile(r"\b(photo|photograph|photographic|photorealistic|realistic|real|skin texture)\b", re.I)
PHOTO_NOUN = re.compile(r"\b(photos?|photographs?|portraits?|shoot|snapshots?|selfies?|self|camera|pictures?|image|still|shot|mirror|phone)\b", re.I)

try:
    from . import choices as _choices
except ImportError:  # run as a plain module (tests)
    try:
        import choices as _choices
    except ImportError:
        _choices = None

_cache = {"mtime": None, "data": None}


def load():
    """The data file, plus your own choices from the Studio (re-read when either file changes)."""
    mtime = (os.path.getmtime(DATA_PATH), _choices.mtime() if _choices else None)
    if _cache["mtime"] != mtime:
        with open(DATA_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _cache["data"] = _choices.merge_cameras(data, _choices.load_choices()) if _choices and mtime[1] else data
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


def look_of(value):
    return next((l for l in load().get("looks", []) if l["value"] == value), None) if value else None


def parts(state):
    """Turn the node's picks into what goes into a prompt. An art style sets its own medium, so it drops the camera and skin."""
    st = state or {}
    l = look_of(st.get("look"))
    art = bool(l and l.get("art"))
    c = None if art else camera_of(st.get("cam"))
    flaws = [o["text"] for o in _pick(c["flaws"], st.get("flaws"))] if c else []
    skin = bool(st.get("skin")) and not art
    bits = [o["text"] for o in _pick(load()["skin"], st.get("skinBits"))] if skin else []
    return {
        "on": st.get("on") is not False, "cam": c["value"] if c else "", "label": c["name"] if c else "",
        "device": c["device"] if c else "", "keepLens": bool(c and c.get("keepLens")), "light": (c.get("light") or "") if c else "",
        "finish": c["finish"] if c else "",
        "flaws": _cap(_list(flaws)) + "." if flaws else "",
        "look": l["value"] if l else "", "lookLabel": l["name"] if l else "", "art": art, "medium": l["medium"] if art else "",
        "lookLight": (l.get("light") or "") if l else "", "grade": l["grade"] if l else "", "frame": (l.get("frame") or "") if l else "",
        "skin": (f"Natural unretouched skin with {_list(bits)}." if bits else "Natural unretouched skin.") if skin else "",
    }


def label_of(p):
    return " · ".join(x for x in [p["label"], p["lookLabel"]] if x) or ("Real skin" if p["skin"] else "")


def _article(m):
    return ("an " if re.match(r"^[aeiou]", m, re.I) else "a ") + m


def camera_text(p):
    if not p["on"]:
        return ""
    if p["art"]:
        return _cap(_article(p["medium"])) + ". " + _cap(p["grade"]) + "."
    dev = ", ".join(x for x in [p["device"], p["frame"]] if x)
    return " ".join(x for x in [_cap(dev) + "." if dev else "", p["light"], p["lookLight"], _cap(p["grade"]) + "." if p["grade"] else "",
                                _cap(p["finish"]) + "." if p["finish"] else "", p["flaws"], p["skin"]] if x)


NOT_ART = re.compile(r"\b(black and white|monochrome|close|detail|high key|low key|model|digitals|test|lookbook|campaign|overhead|wide|beauty)\b", re.I)


def _tidy_lead(keep, medium):
    """Photo words that don't carry over to art, and words the medium already says."""
    said = set(medium.lower().replace("-", " ").split())
    words = [w for w in re.split(r"\s+", NOT_ART.sub(" ", keep)) if w]
    return " ".join(w for w in words if not all(x in said for x in w.lower().replace("-", " ").split(" ")))


def _art_lead(first, medium):
    m = re.match(r"^\[trigger\] in an? ([^,]*?)(?=,)", first)
    if m:
        hit = PHOTO_NOUN.search(m.group(1))
        keep = _tidy_lead(m.group(1)[:hit.start()] if hit else "", medium)
        return "[trigger] in " + _article((keep + " " if keep else "") + medium) + first[len(m.group(0)):]
    if re.match(r"^\[trigger\]\s", first):
        return "[trigger] in " + _article(medium) + "," + first[9:]
    return None


def _bits(s):
    return [b for b in re.split(r",\s*", re.sub(r"\.+$", "", s)) if b]


def _swap(s, c, prot, test, add):
    """Drop the bits that pass test from sentences after c (never the protected ones), and put add where the first one was."""
    done = not add
    i = c + 1
    while i < len(s):
        bits = _bits(s[i])
        hit = lambda b: b not in prot and test(b)
        at = next((j for j, b in enumerate(bits) if hit(b)), -1)
        if at < 0:
            i += 1
            continue
        kept = [b for b in bits if not hit(b)]
        if not done:
            kept.insert(len([b for b in bits[:at] if not hit(b)]), add)
            done = True
        if kept:
            s[i] = _cap(", ".join(kept)) + "."
            i += 1
        else:
            s.pop(i)
    return done


def apply(text, p):
    s = split(text)
    prot = set()

    def guard(t):
        prot.update(_bits(t))

    if p["art"]:
        lead = _art_lead(s[0], p["medium"]) if s else None
        if lead:
            s[0] = lead
        else:
            s.insert(0, _cap(_article(p["medium"])) + ".")
        frm = next((i for i in range(1, len(s)) if CAM.search(s[i])), -1)
        if frm > 0:
            kept = [b for b in _bits(s[frm]) if not LENS.search(b)]
            if kept:
                s[frm] = _cap(", ".join(kept)) + "."
            else:
                s.pop(frm)
                frm -= 1
        else:
            frm = 0
        if not _swap(s, frm, prot, lambda b: PAL.search(b) or FIN.search(b) or REAL.search(b), p["grade"]):
            s.append(_cap(p["grade"]) + ".")
        return " ".join(s)
    if p["cam"] or p["look"]:
        c = next((i for i in range(1, len(s)) if CAM.search(s[i])), -1)
        extra = [x for x in [p["device"], p["frame"]] if x]
        if c < 0:
            if extra:
                s.append(_cap(", ".join(extra)) + ".")
            c = len(s) - 1
        elif extra:
            bits = _bits(s[c])
            kept = bits
            if p["cam"]:
                at = next((i for i, b in enumerate(bits) if LENS.search(b)), len(bits))
                if p["keepLens"]:
                    kept = [re.sub(r"^shot on (\d+\s?mm)$", r"\1 lens", b, flags=re.I) for b in bits]
                else:
                    kept = [b for b in bits if not LENS.search(b)]
                    at = len([b for b in bits[:at] if not LENS.search(b)])
                if at == 0 and kept:
                    kept[0] = _low(kept[0])
                kept.insert(at, p["device"])
            if p["frame"]:
                kept = kept + [p["frame"]]
            s[c] = _cap(", ".join(kept)) + "."
        at = c + 1
        if p["light"] and not any(FLASH.search(x) for x in s[c + 1:]):
            s.insert(at, p["light"])
            guard(p["light"])
            at += 1
        if p["lookLight"]:
            _swap(s, c, prot, lambda b: LIGHTW.search(b) and not PAL.search(b), "")
            s.insert(at, p["lookLight"])
            guard(p["lookLight"])
        if p["grade"]:
            if not _swap(s, c, prot, lambda b: PAL.search(b) or (not p["cam"] and FIN.search(b)), p["grade"]):
                s.append(_cap(p["grade"]) + ".")
            guard(p["grade"])
        if p["cam"] and not _swap(s, c, prot, lambda b: FIN.search(b), p["finish"]):
            s.append(_cap(p["finish"]) + ".")
        if p["flaws"]:
            s.append(p["flaws"])
    if p["skin"]:
        s.append(p["skin"])
    return " ".join(s)


def with_camera(text, p):
    """The prompt after the camera. Returns (text, changed)."""
    if not p or not p.get("on") or (not p.get("cam") and not p.get("look") and not p.get("skin")):
        return text, False
    return apply(text, p), True
