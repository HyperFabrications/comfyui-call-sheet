"""Load the Pose Sheet data and build prompts. Mirrors web/core.js; keep the two in step."""

import json
import os
import re

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "poses.json")

STYLE_RE = re.compile(r"\b(grain|grainy|palette|tones|finish|film|matte|contrast|desaturated|saturated|color grade|grading|print border|monochrome|black and white|halftone)\b|\bcolou?r$", re.I)
COLOR_END = re.compile(r"\b(greens|browns|whites|blues|pinks|reds|tans|golds|creams|grays|greys|blacks|ambers|yellows|oranges|purples|neutrals|pastels|accents|ivories|coppers)$", re.I)
LIGHTY = re.compile(r"\b(light|lights|sun|sunlight|lamp|flash|shadow|shadows|sky|window|glow|neon|highlights)\b", re.I)
COLOR_WORD = re.compile(r"^(amber|charcoal|evergreen|ivory|cream|rust|navy|sage|stone|olive|honey|gold|golden|blush|peach|burgundy|emerald|slate|oatmeal|mint|copper|tawny|white|black|gray|grey|brown|pink|red|blue|green)$", re.I)

_cache = {"mtime": None, "data": None}


def load():
    """Return the parsed poses.json, re-reading it if the file changed."""
    mtime = os.path.getmtime(DATA_PATH)
    if _cache["mtime"] != mtime:
        with open(DATA_PATH, encoding="utf-8") as f:
            _cache["data"] = json.load(f)
        _cache["mtime"] = mtime
    return _cache["data"]


def strip_style(t):
    lead = re.match(r"^\[trigger\] in an? ([^,]*?)(?=,)", t)
    if lead:
        L = lead.group(1)
        rep = None
        if "selfie" in L:
            rep = "[trigger] in a " + re.sub(r"^.*?((?:mirror |phone )?selfie)", r"\1", L, count=1)
        elif "implied nude" in L:
            rep = "[trigger], implied nude"
        elif re.search(r"\b(photograph|photo|portrait|shot)\b", L):
            rep = "[trigger]"
        if rep:
            t = rep + t[len(lead.group(0)):]
    sentences = re.findall(r"[^.]+(?:\.|$)", t) or [t]
    out = []
    for s in sentences:
        end = "." if s.strip().endswith(".") else ""
        body = re.sub(r"\.$", "", s.strip())
        if not body:
            continue
        parts = re.split(r",\s*", body)
        keep = [not (STYLE_RE.search(p) or (COLOR_END.search(p.strip()) and not LIGHTY.search(p))) for p in parts]
        for i in range(len(parts) - 2, -1, -1):
            if not keep[i + 1] and COLOR_WORD.search(parts[i].strip()):
                keep[i] = False
        kept = [p for p, k in zip(parts, keep) if k]
        if not kept:
            continue
        k = ", ".join(kept)
        if k[0] == k[0].lower() and not out and not k.startswith("["):
            k = k[0].upper() + k[1:]
        out.append(k + end)
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def person_text(person):
    p = lambda k: person.get(k) or ""
    if not any(person.values()):
        return ""
    lead = " ".join(x for x in [p("height"), "adult", p("gender") or "person"] if x)
    art = "an" if re.match(r"^[aeiou]", lead, re.I) else "a"
    bits = []
    if p("body"):
        bits.append(("an" if re.match(r"^[aeiou]", p("body"), re.I) else "a") + " " + p("body") + " build")
    hair = " ".join(x for x in [p("length"), p("htype"), p("hcolor")] if x)
    if hair or p("length") == "shaved":
        bits.append("a shaved head" if p("length") == "shaved" else hair + " hair")
    if p("eyes"):
        bits.append(p("eyes") + " eyes")
    if p("skin") or p("complexion"):
        s = (p("complexion") + " " if p("complexion") else "") + (p("skin") + " " if p("skin") else "") + "skin"
        bits.append(re.sub(r"\s+", " ", re.sub(r",\s", " ", s, count=1)).strip())
    lst = ", ".join(bits[:-1]) + " and " + bits[-1] if len(bits) > 1 else (bits[0] if bits else "")
    return f"{art} {lead}" + (f" with {lst}" if lst else "")


def subject(trigger, person_desc):
    t = (trigger or "").strip()
    d = person_desc or ""
    if not d:
        return t or "[trigger]"
    return f"{t}, {d}," if t else d


def base(frame, style_on):
    return frame["text"] if style_on else (frame.get("bare") or strip_style(frame["text"]))


def fill(text, subj):
    return re.sub(r"\[trigger\](,?)", lambda m: subj if subj.endswith(",") else subj + m.group(1), text)


def prompt_for(frame, trigger="", person="", style=True):
    return fill(base(frame, style), subject(trigger, person))


def frame_key(f):
    return f"{f['id']} · {f['title']}"
