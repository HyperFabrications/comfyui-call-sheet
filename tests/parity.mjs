// Checks that pose_data.py builds exactly the same prompts as web/core.js.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { promptFor, personText } from "../web/core.js";
const data = JSON.parse(fs.readFileSync(new URL("../web/poses.json", import.meta.url)));
const people = [{}, { gender: "woman", body: "athletic", length: "long", htype: "wavy", hcolor: "auburn", eyes: "green", skin: "olive", complexion: "clear, even" }, { length: "shaved", height: "tall" }, { complexion: "dewy, glowing" }, { gender: "man", age: "thirties", height: "tall" }, { age: "elderly", hcolor: "silver gray" }, { gender: "androgynous person", age: "forties" }, { gender: "woman", age: "young adult", body: "curvy" }];
const cases = [];
for (const f of data.frames) for (const style of [true, false]) for (const trigger of ["", "ohwx woman"]) for (const p of people)
  cases.push({ id: f.id, style, trigger, person: p, expect: promptFor(f, { trigger, person: personText(p), style }) });
const py = `
import json, sys
sys.path.insert(0, ".")
import pose_data as P
cases = json.load(sys.stdin)
frames = {f["id"]: f for f in P.load()["frames"]}
bad = 0
for c in cases:
    got = P.prompt_for(frames[c["id"]], c["trigger"], P.person_text(c["person"]), c["style"])
    if got != c["expect"]:
        bad += 1
        if bad < 4: print("MISMATCH", c["id"], c["style"], "\\n JS:", c["expect"], "\\n PY:", got)
print(f"{len(cases) - bad}/{len(cases)} prompts match")
sys.exit(1 if bad else 0)
`;
console.log(execFileSync("python3", ["-c", py], { input: JSON.stringify(cases), encoding: "utf8" }).trim());
