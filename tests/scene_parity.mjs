// Checks that scene_data.py builds exactly the same scene prompts as web/scene_core.js.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { places, parts, sceneText, apply, plate, withScene } from "../web/scene_core.js";
const data = JSON.parse(fs.readFileSync(new URL("../web/poses.json", import.meta.url)));
const scenes = JSON.parse(fs.readFileSync(new URL("../web/scenes.json", import.meta.url)));
const custom = [{ id: "L1", title: "Paris bookshop", bg: "Tall shelves of old books, a rolling ladder and worn wooden floorboards.", light: "Warm lamp light." }];
const pl = places(scenes, data.frames, custom);
const states = [
  { location: "city", time: "night", weather: "rain", lighting: "neon", mood: "moody" },
  { place: "S59", time: "golden" }, { place: "S57" }, { place: "L1", era: "70s" },
  { time: "night", era: "70s" }, { location: "beach", plate: true }, { plate: true }, { location: "studio", lighting: "softbox", on: false },
];
const cases = [];
for (const st of states) {
  const p = parts(scenes, st, pl);
  cases.push({ kind: "parts", st, expect: JSON.stringify(p) + "|" + sceneText(p) });
  for (const f of data.frames) {
    cases.push({ kind: "apply", st, id: f.id, expect: apply(f.text, p) });
    cases.push({ kind: "plate", st, id: f.id, expect: plate(f.text, p) + "|" + plate(f.text) });
    cases.push({ kind: "with", st, id: f.id, expect: JSON.stringify(withScene(scenes, f, p, ["S22"])) });
  }
}
const py = `
import json, sys
sys.path.insert(0, ".")
import pose_data as P, scene_data as S
cases = json.load(sys.stdin)
frames = {f["id"]: f for f in P.load()["frames"]}
custom = [{"id": "L1", "title": "Paris bookshop", "bg": "Tall shelves of old books, a rolling ladder and worn wooden floorboards.", "light": "Warm lamp light."}]
pl = S.places(P.load()["frames"], custom)
bad = 0
for c in cases:
    p = S.parts(c["st"], pl)
    if c["kind"] == "parts":
        got = json.dumps(p, separators=(",", ":"), ensure_ascii=False) + "|" + S.scene_text(p)
    elif c["kind"] == "apply":
        got = S.apply(frames[c["id"]]["text"], p)
    elif c["kind"] == "plate":
        got = S.plate(frames[c["id"]]["text"], p) + "|" + S.plate(frames[c["id"]]["text"])
    else:
        t, ch = S.with_scene(frames[c["id"]], p, ["S22"])
        got = json.dumps([t, ch], separators=(",", ":"), ensure_ascii=False)
    if got != c["expect"]:
        bad += 1
        if bad < 4: print("MISMATCH", c["kind"], c.get("id"), c["st"], "\\n JS:", c["expect"], "\\n PY:", got)
print(f"{len(cases) - bad}/{len(cases)} scene cases match")
sys.exit(1 if bad else 0)
`;
console.log(execFileSync("python3", ["-c", py], { input: JSON.stringify(cases), encoding: "utf8" }).trim());
