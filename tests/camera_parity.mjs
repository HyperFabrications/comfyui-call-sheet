// Checks that camera_data.py builds exactly the same camera prompts as web/camera_core.js, and that
// pose_data.prompt_for with a camera matches core.js promptFor.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { parts, cameraText, labelOf, withCamera } from "../web/camera_core.js";
import { promptFor } from "../web/core.js";
const data = JSON.parse(fs.readFileSync(new URL("../web/poses.json", import.meta.url)));
const cams = JSON.parse(fs.readFileSync(new URL("../web/cameras.json", import.meta.url)));
const states = [{}, { skin: true }, { skin: true, skinBits: { pores: false, texture: false } }, { cam: "phone", on: false, skin: true },
  ...cams.cameras.map(c => ({ cam: c.value })),
  ...cams.cameras.map(c => ({ cam: c.value, skin: true, flaws: Object.fromEntries(c.flaws.map(o => [o.key, !o.on])), skinBits: { freckles: true, fuzz: true } })),
  { cam: "nope", skin: true }, { look: "nope" },
  ...cams.looks.map((l, i) => ({ look: l.value, cam: cams.cameras[i % cams.cameras.length].value, skin: i % 2 === 0 })),
  ...cams.looks.map(l => ({ look: l.value }))];
const cases = [];
for (const st of states) {
  const p = parts(cams, st);
  cases.push({ kind: "parts", st, expect: JSON.stringify(p) + "|" + cameraText(p) + "|" + labelOf(p) });
  for (const f of data.frames) {
    cases.push({ kind: "with", st, id: f.id, expect: JSON.stringify(withCamera(f.text, p)) });
    if (p.cam || p.look) cases.push({ kind: "bare", st, id: f.id, expect: promptFor(f, { trigger: "ohwx", style: false, camera: p }) });
  }
}
const py = `
import json, sys
sys.path.insert(0, ".")
import pose_data as P, camera_data as C
cases = json.load(sys.stdin)
frames = {f["id"]: f for f in P.load()["frames"]}
bad = 0
for c in cases:
    p = C.parts(c["st"])
    if c["kind"] == "parts":
        got = json.dumps(p, separators=(",", ":"), ensure_ascii=False) + "|" + C.camera_text(p) + "|" + C.label_of(p)
    elif c["kind"] == "with":
        t, ch = C.with_camera(frames[c["id"]]["text"], p)
        got = json.dumps([t, ch], separators=(",", ":"), ensure_ascii=False)
    else:
        got = P.prompt_for(frames[c["id"]], "ohwx", "", False, camera=p)
    if got != c["expect"]:
        bad += 1
        if bad < 4: print("MISMATCH", c["kind"], c.get("id"), c["st"], "\\n JS:", c["expect"], "\\n PY:", got)
print(f"{len(cases) - bad}/{len(cases)} camera cases match")
sys.exit(1 if bad else 0)
`;
console.log(execFileSync("python3", ["-c", py], { input: JSON.stringify(cases), encoding: "utf8" }).trim());
