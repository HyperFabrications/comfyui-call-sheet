// Checks that the Call Sheet node (nodes.py KreaCallSheet) writes the same prompt as the Studio shows (web/studio.js shotOf),
// for many frames with random person, outfit, scene and camera picks.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { shotOf } from "../web/studio.js";
import { places as placeList } from "../web/scene_core.js";
import { frameKey } from "../web/core.js";
const read = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const data = read("../web/poses.json"), scenes = read("../web/scenes.json"), outfits = read("../web/outfits.json"), cams = read("../web/cameras.json");
const env = { data, scenes, outfits, cams, places: () => placeList(scenes, data.frames, []), items: () => [], choices: () => [] };

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const maybe = (p, f) => rnd() < p ? f() : undefined;
const optOf = (cats, key) => (cats.find(c => c.key === key) || { options: [] }).options.map(o => o.value).filter(Boolean);

const cases = [];
for (let i = 0; i < 600; i++) {
  const f = pick(data.frames);
  const st = {};
  const picks = {};
  for (const t of data.traits) { const v = maybe(.4, () => pick(t.options.map(o => o.value).filter(Boolean))); if (v) picks[t.key] = v; }
  st.person = { picks, on: rnd() > .1, ...(rnd() < .1 ? { text: "a tall woman with silver hair" } : {}) };
  const o = { on: rnd() > .1, swap: rnd() < .3 ? "pick" : "whole" };
  for (const k of ["top", "bottom", "one", "outer", "shoes"]) { const v = maybe(.35, () => pick(optOf(outfits.categories, k))); if (v) o[k] = v; }
  if (rnd() < .3) o.acc = [pick(optOf(outfits.categories, "acc"))];
  if (o.top && rnd() < .5) o.topC = pick(outfits.colors).value;
  st.outfit = o;
  const s = { on: rnd() > .1, plate: rnd() < .1 };
  if (rnd() < .3) s.place = pick(env.places()).id;
  for (const c of scenes.categories) { const v = maybe(.25, () => pick(c.options.map(x => x.value))); if (v) s[c.key] = v; }
  st.scene = s;
  st.camera = { on: rnd() > .1, ...(rnd() < .5 ? { cam: pick(cams.cameras).value } : {}), ...(rnd() < .4 ? { look: pick(cams.looks).value } : {}), skin: rnd() < .3 };
  if (rnd() < .15) st.outfitOverrides = [f.id];
  if (rnd() < .15) st.sceneOverrides = [f.id];
  if (rnd() < .05) st.edits = { [f.id]: "[trigger] standing by a window, one hand on the frame. Wearing a white tee. A bright kitchen behind her. Medium shot at eye level. Soft daylight." };
  const trigger = rnd() < .5 ? "" : "ohwx woman", style = rnd() > .2;
  cases.push({ frame: frameKey(f), trigger, style, studio: JSON.stringify(st), expect: shotOf(env, f, st, { trigger, style }).text });
}

const py = `
import json, sys, os, importlib.util
root = os.getcwd()
spec = importlib.util.spec_from_file_location("callsheet_pkg", os.path.join(root, "__init__.py"), submodule_search_locations=[root])
pkg = importlib.util.module_from_spec(spec); sys.modules["callsheet_pkg"] = pkg
import importlib
nodes = importlib.import_module("callsheet_pkg.nodes")
# Test against the shipped data only, not anything saved on this machine.
nodes.load_custom = lambda: []
nodes.load_items = lambda: []
nodes.load_places = lambda: []
cases = json.load(sys.stdin)
node = nodes.KreaCallSheet()
bad = []
for i, c in enumerate(cases):
    got = node.build(c["frame"], "single frame", c["trigger"], c["style"], c["studio"])[0]
    if got != c["expect"]: bad.append((i, got, c["expect"]))
for i, a, b in bad[:3]: print("MISMATCH", i, "\\n PY:", a, "\\n JS:", b)
print(f"{len(cases) - len(bad)}/{len(cases)} Call Sheet cases match")
sys.exit(1 if bad else 0)
`;
console.log(execFileSync("python3", ["-c", py], { input: JSON.stringify(cases), encoding: "utf8", cwd: new URL("..", import.meta.url).pathname, maxBuffer: 1 << 26 }).trim());
