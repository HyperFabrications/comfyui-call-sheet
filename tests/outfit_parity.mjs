// Checks that outfit_data.py builds exactly the same outfit prompts as web/outfit_core.js.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { parts, outfitText, apply, withOutfit, pieces } from "../web/outfit_core.js";
const data = JSON.parse(fs.readFileSync(new URL("../web/poses.json", import.meta.url)));
const outfits = JSON.parse(fs.readFileSync(new URL("../web/outfits.json", import.meta.url)));
const items = [{ id: "I1", cat: "top", name: "Lace cami", text: "a black lace camisole" }, { id: "I2", cat: "acc", name: "Locket", text: "a gold locket necklace" }];
const custom = [
  { id: "U1", tab: "custom", text: "[trigger] standing by a window. Wearing a red dress and heels. Soft light." },
  { id: "U2", tab: "custom", text: "[trigger] sitting on stairs. Soft light." },
];
const frames = [...data.frames, ...custom];
const states = [
  { top: "tee", topC: "white", bottom: "jeans", bottomC: "indigo", shoes: "sneakers" },
  { one: "slip", oneC: "black", outer: "trench", shoes: "heels", acc: ["hoops", "I2"] },
  { top: "I1", bottom: "midi", bottomC: "sage", outer: "leather", swap: "pick" },
  { outer: "blazer", outerC: "navy", swap: "pick" },
  { shoes: "ankle", acc: ["sunglasses", "beret"], swap: "pick" },
  { one: "jump", oneC: "olive", swap: "pick" },
  { top: "sweater", topC: "cream", bottom: "trousers", on: false },
  {},
];
const cases = [];
for (const st of states) {
  const p = parts(outfits, st, items);
  cases.push({ kind: "parts", st, expect: JSON.stringify(p) + "|" + outfitText(p) });
  for (const f of frames) {
    cases.push({ kind: "apply", st, id: f.id, expect: apply(f.text, p) });
    cases.push({ kind: "with", st, id: f.id, expect: JSON.stringify(withOutfit(outfits, f, p, ["S25"])) });
  }
}
for (const f of frames) cases.push({ kind: "pieces", id: f.id, st: {}, expect: JSON.stringify(f.text.split(/(?<=\.)\s+/).filter(x => /^(wearing|she wears|she is wearing)\b/i.test(x)).map(pieces)) });
const py = `
import json, sys, re
sys.path.insert(0, ".")
import pose_data as P, outfit_data as O
cases = json.load(sys.stdin)
items = ${JSON.stringify(items)}
frames = {f["id"]: f for f in P.load()["frames"] + ${JSON.stringify(custom)}}
j = lambda x: json.dumps(x, separators=(",", ":"), ensure_ascii=False)
bad = 0
for c in cases:
    p = O.parts(c["st"], items)
    f = frames[c.get("id")] if c.get("id") else None
    if c["kind"] == "parts":
        got = j(p) + "|" + O.outfit_text(p)
    elif c["kind"] == "apply":
        got = O.apply(f["text"], p)
    elif c["kind"] == "pieces":
        got = j([O.pieces(x) for x in re.split(r"(?<=\\.)\\s+", f["text"]) if O.WEARING.search(x)])
    else:
        t, ch = O.with_outfit(f, p, ["S25"])
        got = j([t, ch])
    if got != c["expect"]:
        bad += 1
        if bad < 4: print("MISMATCH", c["kind"], c.get("id"), c["st"], "\\n JS:", c["expect"], "\\n PY:", got)
print(f"{len(cases) - bad}/{len(cases)} outfit cases match")
sys.exit(1 if bad else 0)
`;
console.log(execFileSync("python3", ["-c", py], { input: JSON.stringify(cases), encoding: "utf8" }).trim());
