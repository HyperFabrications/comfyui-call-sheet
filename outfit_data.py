"""Outfits: swap what she's wearing in a frame, either the whole outfit or only the pieces you pick.
Mirrors web/outfit_core.js; keep the two in step (tests/outfit_parity.mjs checks them)."""

import json
import os
import re

try:
    from .scene_data import split
except ImportError:  # run as a plain module (tests)
    from scene_data import split

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "outfits.json")

WEARING = re.compile(r"^(wearing|she wears|she is wearing)\b", re.I)
KINDS = [
    ("shoes", re.compile(r"\b(shoes|boots?|heels|sneakers|trainers|loafers|sandals|mules|pumps|flats|slippers|stilettos|espadrilles|clogs|oxfords|feet|platforms|slides|flip flops|flip-flops|wedges|moccasins|slingbacks)\b", re.I)),
    ("legs", re.compile(r"\b(tights|stockings|socks|leg warmers|thigh highs|garters?|hosiery|fishnets)\b", re.I)),
    ("one", re.compile(r"\b(dress|sundress|gown|jumpsuit|romper|playsuit|bodysuit|swimsuit|bikini|leotard|catsuit|overalls|coveralls|suit|slip|kimono|robe|teddy|babydoll|nightgown|chemise)\b", re.I)),
    ("outer", re.compile(r"\b(coat|peacoat|raincoat|overcoat|jacket|bomber|blazer|cardigan|parka|puffer|trench|shawl|cape|poncho|gilet|shacket|overshirt)\b", re.I)),
    ("bottom", re.compile(r"\b(jeans|trousers|pants|skirt|shorts|leggings|joggers|sweatpants|culottes|slacks|chinos|bottoms|panties|briefs|thong|knickers|underwear|boyshorts)\b", re.I)),
    ("top", re.compile(r"\b(tee|t-shirt|shirt|blouse|tank|sweater|jumper|turtleneck|hoodie|sweatshirt|top|camisole|cami|bralette|bra|corset|bustier|henley|polo|halter|bandeau|pullover|vest)\b", re.I)),
    ("acc", re.compile(r"\b(earrings?|necklace|choker|pendant|bracelets?|bangles?|watch|rings?|bag|purse|clutch|tote|backpack|belt|hat|cap|beret|beanie|scarf|bandana|headband|sunglasses|glasses|eyeglasses|gloves|clip|barrette|ribbon|bow|anklet|pearls|hoops|tiara|jewelry|apron|earbuds|headphones)\b", re.I)),
    ("face", re.compile(r"\b(lips|lipstick|gloss|blush|eyeliner|mascara|makeup|nails|manicure|polish|freckles|eyeshadow|lashes|brows|bronzer|highlighter|tattoos?|piercings?)\b", re.I)),
]

_cache = {"mtime": None, "data": None}


def load():
    mtime = os.path.getmtime(DATA_PATH)
    if _cache["mtime"] != mtime:
        with open(DATA_PATH, encoding="utf-8") as f:
            _cache["data"] = json.load(f)
        _cache["mtime"] = mtime
    return _cache["data"]


def kind_of(s):
    for k, rx in KINDS:
        if rx.search(s):
            return k
    return ""


def pieces(line):
    """The frame's clothing line, split into pieces: [{slot, text}]."""
    body = re.sub(r"[\s.]+$", "", re.sub(r"^[\s,]+", "", WEARING.sub("", line, count=1)))
    out = []

    def push(t):
        # "white socks with slides" is two pieces, so the shoes can change and the socks stay.
        t = t.strip()
        if not t:
            return
        w = re.match(r"^(.+?)\s+with\s+(.+)$", t)
        if w and kind_of(w.group(1)) == "legs" and kind_of(w.group(2)) == "shoes":
            out.extend([{"slot": "legs", "text": w.group(1)}, {"slot": "shoes", "text": w.group(2)}])
            return
        out.append({"slot": kind_of(t), "text": t})

    for chunk in re.split(r",\s*", body):
        c = re.sub(r"^and\s+", "", chunk, count=1)
        ov = re.split(r"\s+over\s+", c)
        for part0 in (ov if len(ov) > 1 and all(kind_of(b) for b in ov) else [c]):
            got, carry = [], ""
            for b in re.split(r"\s+and\s+", part0):
                cur = carry + " and " + b if carry else b
                if kind_of(b):
                    got.append(cur)
                    carry = ""
                else:
                    carry = cur
            if carry:
                if got:
                    got[-1] += " and " + carry
                else:
                    got.append(carry)
            for g in got:
                push(g)
    for i in range(1, len(out)):
        if not out[i]["slot"]:
            out[i]["slot"] = out[i - 1]["slot"]
    if out and not out[0]["slot"]:
        out[0]["slot"] = "top"
    return out


def _list(a):
    return a[0] if len(a) == 1 else ", ".join(a[:-1]) + " and " + a[-1]


def compose(ps):
    """Pieces back into one sentence: outerwear goes over the top or the one piece."""
    by = lambda k: [p["text"] for p in ps if p["slot"] == k]
    outer, body = by("outer"), by("one") + by("top")
    words = []
    if outer and body:
        words.append(" and ".join(outer) + " over " + body[0])
        words.extend(body[1:])
    else:
        words.extend(outer + body)
    for k in ("bottom", "legs", "shoes", "acc", "face"):
        words.extend(by(k))
    return "Wearing " + _list(words) + "." if words else ""


def _an(s):
    return re.sub(r"^a (?=[aeiou])", "an ", s, count=1, flags=re.I)


def _option(cat, value):
    c = next((x for x in load()["categories"] if x["key"] == cat), None)
    if not c or not value:
        return None
    return next((o for o in c["options"] if o["value"] == value), None)


def phrase(cat, value, color, items=()):
    mine = next((x for x in items if x.get("id") == value), None)
    if mine:
        return mine.get("text", "")
    o = _option(cat, value)
    if not o:
        return ""
    c = next((x for x in load()["colors"] if x["value"] == (color or o["color"])), None)
    return _an(re.sub(r"\s+", " ", o["text"].replace("{c}", c["word"] if c else "", 1)).strip())


def parts(state, items=()):
    """Turn the builder's picks into pieces."""
    st = state or {}
    out = []

    def add(slot, value, color):
        t = phrase(slot, value, color, items)
        if t:
            out.append({"slot": slot, "text": t})

    if st.get("one"):
        add("one", st.get("one"), st.get("oneC"))
    else:
        add("top", st.get("top"), st.get("topC"))
        add("bottom", st.get("bottom"), st.get("bottomC"))
    add("outer", st.get("outer"), st.get("outerC"))
    add("shoes", st.get("shoes"), st.get("shoesC"))
    for a in st.get("acc") if isinstance(st.get("acc"), list) else []:
        add("acc", a, "")
    has = lambda k: any(p["slot"] == k for p in out)
    return {"pieces": out, "swap": "pick" if st.get("swap") == "pick" else "whole", "on": st.get("on") is not False,
            "dressed": has("one") or (has("top") and has("bottom"))}


def outfit_text(p):
    return compose(p["pieces"])


def merge(frame, p):
    if p["swap"] != "pick":
        return p["pieces"] + [x for x in frame if x["slot"] == "face"]
    picked = {x["slot"] for x in p["pieces"]}
    drop = set()
    if "one" in picked:
        drop.update(("one", "top", "bottom"))
    if "top" in picked:
        drop.update(("top", "one"))
    if "bottom" in picked:
        drop.update(("bottom", "one"))
    for k in ("outer", "shoes"):
        if k in picked:
            drop.add(k)
    return [x for x in frame if x["slot"] not in drop] + p["pieces"]


def apply(text, p):
    if not p["pieces"]:
        return text
    s = split(text)
    i = next((j for j in range(1, len(s)) if WEARING.search(s[j])), -1)
    line = compose(merge(pieces(s[i]) if i >= 0 else [], p))
    if i >= 0:
        s[i] = line
    else:
        s.insert(min(1, len(s)), line)
    return " ".join(s)


def locked(frame, overrides=()):
    if frame["id"] in overrides:
        return False
    if frame.get("tab") == "custom":
        s = split(frame["text"])
        return not any(WEARING.search(x) for x in s[1:])
    v = load()["frames"].get(frame["id"])
    return v is None or v != ""


def with_outfit(frame, p, overrides=()):
    """The frame's text after the outfit. Returns (text, changed)."""
    if not p or p.get("on") is False or not p.get("pieces"):
        return frame["text"], False
    if locked(frame, overrides):
        return frame["text"], False
    t = apply(frame["text"], p)
    return t, t != frame["text"]
