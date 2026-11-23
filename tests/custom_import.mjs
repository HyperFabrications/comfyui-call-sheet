// Pasted prompt lists: one prompt per line, names, bullets, wrapped lines and the [trigger] lead.
import { parsePromptList } from "../web/custom.js";

const cases = [
  ["[trigger] in a mirror selfie, standing by the bed.\n[trigger] in a candid photo, walking across a crosswalk at night.\n",
    [["Standing by the bed", "[trigger] in a mirror selfie, standing by the bed."], ["Walking across a crosswalk at night", "[trigger] in a candid photo, walking across a crosswalk at night."]]],
  ["Window seat\n[trigger] curled up on a window seat, holding a mug.", [["Window seat", "[trigger] curled up on a window seat, holding a mug."]]],
  ["1. A young woman leaning on a railing at sunset.\n- \"Close up portrait laughing in the rain.\"",
    [["Leaning on a railing at sunset", "[trigger], a young woman leaning on a railing at sunset."], ["Close up portrait laughing", "[trigger], close up portrait laughing in the rain."]]],
  ["[trigger] sitting on the floor,\nlegs crossed, looking up.\n\nPrompts", [["Sitting on the floor", "[trigger] sitting on the floor, legs crossed, looking up."]]],
  ["A woman in a cafe\nsitting by the window with a coffee.", [["In a cafe sitting", "[trigger], a woman in a cafe sitting by the window with a coffee."]]],
  ["A stunning redhead woman with freckles sitting on a bench in a park.", [["With freckles sitting on a bench", "[trigger], a stunning redhead woman with freckles sitting on a bench in a park."]]],
  ["", []],
];
let bad = 0;
for (const [input, want] of cases) {
  const got = parsePromptList(input).map(x => [x.title, x.text]);
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log("MISMATCH", JSON.stringify(input), "\n got ", JSON.stringify(got), "\n want", JSON.stringify(want)); }
}
console.log(`${cases.length - bad}/${cases.length} list import cases match`);
if (bad) process.exit(1);
