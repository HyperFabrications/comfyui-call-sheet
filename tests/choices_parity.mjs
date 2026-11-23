// Checks that your own Studio choices merge and read the same in Python (choices.py) and JS (web/choices.js).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { mergeScenes, mergeCameras } from "../web/choices.js";
import { parts as sceneParts } from "../web/scene_core.js";
import { parts as camParts } from "../web/camera_core.js";
const read = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const choices = [
  { id: "C1", layer: "scene", group: "time", name: "Late afternoon", text: "in late afternoon light" },
  { id: "C2", layer: "scene", group: "location", name: "Grandma's kitchen", text: "a small 1970s kitchen with mustard tiles" },
  { id: "C3", layer: "scene", group: "lighting", name: "TV glow", text: "Blue light from an old television." },
  { id: "C4", layer: "camera", group: "cam", name: "Webcam", text: "taken on a laptop webcam, soft and low resolution" },
  { id: "C5", layer: "camera", group: "flaws", name: "Lens flare", text: "a streak of lens flare across the frame" },
  { id: "C6", layer: "camera", group: "skin", name: "Sunburn", text: "light sunburn across the nose" },
  { id: "C7", layer: "camera", group: "look:Film and grade", name: "Teal and orange", text: "teal shadows and warm orange skin tones" },
  { id: "C8", layer: "camera", group: "look:Art styles", name: "Pencil sketch", text: "soft graphite shading on textured paper" },
];
const scenes = mergeScenes(read("../web/scenes.json"), choices), cams = mergeCameras(read("../web/cameras.json"), choices);
const sStates = [{ location: "C2", time: "C1" }, { time: "C1", lighting: "C3" }, { location: "beach", time: "C1", mood: "calm" }];
const cStates = [{ cam: "C4", flaws: { C5: true } }, { cam: "phone", flaws: { C5: true } }, { look: "C7", skin: true, skinBits: { C6: true } }, { look: "C8" }, { cam: "C4", look: "C7" }];
const expect = { scenes: sStates.map(s => sceneParts(scenes, s, [])), cams: cStates.map(s => camParts(cams, s)) };
const py = `
import json, sys
sys.path.insert(0, ".")
import choices, scene_data as S, camera_data as C
inp = json.load(sys.stdin)
sd = choices.merge_scenes(S.load(), inp["choices"]); cd = choices.merge_cameras(C.load(), inp["choices"])
S._cache["data"], S._cache["mtime"] = sd, "test"
C._cache["data"], C._cache["mtime"] = cd, "test"
S.load = lambda: sd
C.load = lambda: cd
got = {"scenes": [S.parts(s, []) for s in inp["s"]], "cams": [C.parts(s) for s in inp["c"]]}
bad = [(k, i) for k in got for i, (a, b) in enumerate(zip(got[k], inp["expect"][k])) if a != b]
for k, i in bad[:3]: print("MISMATCH", k, i, "\\n PY:", got[k][i], "\\n JS:", inp["expect"][k][i])
print(f"{len(inp['s']) + len(inp['c']) - len(bad)}/{len(inp['s']) + len(inp['c'])} choice cases match")
sys.exit(1 if bad else 0)
`;
console.log(execFileSync("python3", ["-c", py], { input: JSON.stringify({ choices, s: sStates, c: cStates, expect }), encoding: "utf8" }).trim());
