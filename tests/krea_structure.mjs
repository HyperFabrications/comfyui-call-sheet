// Checks that a prompt using every part of Call Sheet at once (Pose only, Person, Outfit, Scene with lighting, Camera
// with a look) still reads the way Krea 2 wants: one plain sentence per part, in the order subject and pose, clothes,
// setting, camera, light, finish, with one light source and no word said twice.
import fs from "node:fs";
import { shotOf } from "../web/studio.js";
import { places as placeList, split } from "../web/scene_core.js";
import { parts as camParts } from "../web/camera_core.js";
const read = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const data = read("../web/poses.json"), scenes = read("../web/scenes.json"), outfits = read("../web/outfits.json"), cams = read("../web/cameras.json");
const poseLines = read("../web/poselines.json").frames;
const env = { data, scenes, outfits, cams, poseLines, places: () => placeList(scenes, data.frames, []), items: () => [], choices: () => [] };

const CAM = /\b(taken (?:as|on)|shot|lens|crop|cropped|close[- ]?up|eye level|full length|low angle|high angle|from above|from below|framing|framed from)\b/i;
const SOURCE = /\b(light|lights|lighting|lit|sun|sunlight|daylight|lamps?|flash|glow|candlelight|backlight|spotlight)\b/i;
const opts = k => scenes.categories.find(c => c.key === k).options.map(o => o.value);
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const ids = Object.keys(poseLines), bad = [];
let n = 0;
for (let i = 0; i < 1500; i++) {
  const id = pick(ids), f = data.frames.find(x => x.id === id);
  if (!f) { console.log("no frame", JSON.stringify(id), ids.length); process.exit(2); }
  const st = {
    poseOnly: true,
    person: { picks: { gender: "woman", length: "long", htype: "wavy", hcolor: "dark brown", age: "thirties" } },
    outfit: { top: pick(["tee", "sweater", "blouse"]), bottom: pick(["jeans", "midi", "trousers"]), shoes: pick(["sneakers", "ankle", "heels"]), acc: [pick(["hoops", "pearls"])] },
    scene: { location: pick(opts("location")), time: pick(opts("time")), lighting: pick(opts("lighting")), mood: pick(opts("mood")) },
    camera: { cam: pick(cams.cameras.filter(c => !c.mine).map(c => c.value)), look: pick(["", ...cams.looks.filter(l => !l.art).map(l => l.value)]), skin: rnd() < .5 },
  };
  const text = shotOf(env, f, st, { trigger: "", style: true }).text, s = split(text);
  const cp = camParts(cams, st.camera), up = x => x && x[0].toUpperCase() + x.slice(1).replace(/\.?$/, ".");
  const extras = new Set([cp.flaws, cp.skin, up(cp.finish), up(cp.grade)].filter(Boolean));
  const w = s.findIndex(x => /^Wearing\b/.test(x)), c = s.findIndex((x, j) => j > 0 && CAM.test(x));
  const fin = cp.finish ? up(cp.finish).replace(/\.$/, "") : "\u0000";
  const sources = s.slice(c + 1).filter(x => !extras.has(x) && !x.startsWith(fin) && SOURCE.test(x));
  const bits = s.slice(c + 1).flatMap(x => x.replace(/\.$/, "").toLowerCase().split(/,\s*/));
  const why = [];
  if (w !== 1) why.push("clothes are not the second sentence");
  if (!(c > w + 1)) why.push("the setting is not between the clothes and the camera");
  if (sources.length !== 1) why.push(`${sources.length} light sentences`);
  if (new Set(bits).size !== bits.length) why.push("a finish word is said twice");
  if (s.some(x => !/[.]$/.test(x) || x.split(/,\s*/).length > 8)) why.push("a sentence reads like a tag list");
  n++;
  if (why.length) bad.push([f.id, why.join("; "), text]);
}
const tally = {}; for (const [, why] of bad) tally[why] = (tally[why] || 0) + 1; if (process.env.V) console.log(tally);
for (const [id, why, t] of bad.slice(0, process.env.V ? +process.env.V : 3)) console.log("BAD", id, why, "\n ", t);
console.log(`${n - bad.length}/${n} full Call Sheet prompts follow the Krea 2 order`);
process.exit(bad.length ? 1 : 0);
