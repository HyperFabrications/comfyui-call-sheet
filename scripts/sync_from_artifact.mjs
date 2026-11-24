// Rebuild web/poses.json from a saved copy of the live Pose Sheet artifact HTML.
// Usage: node scripts/sync_from_artifact.mjs path/to/pose-sheet.html
import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const lines = html.split("\n");
const start = lines.findIndex(l => l.startsWith("const DATA = ["));
const stop = lines.findIndex(l => l.startsWith("const ORDER.all") || l.startsWith("ORDER.all"));
const tStart = lines.findIndex(l => l.startsWith("const TRAITS = ["));
const tStop = lines.findIndex((l, i) => i > tStart && l.startsWith("];"));
if (start < 0 || stop < 0 || tStart < 0 || tStop < 0) throw new Error("Could not find the data blocks in the artifact HTML");
const src = lines.slice(start, stop).join("\n") + "\n" + lines.slice(tStart, tStop + 1).join("\n") +
  "\n;globalThis.__out = {DATA,UPDATED,CHANGELOG,ORDER,LABELS,TABNAME,TRAITS};";
const ctx = { location: { hash: "" } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const o = ctx.__out;
const keys = ["id", "tab", "set", "title", "text", "bare", "note", "src", "ex", "added", "upd"];
// Links to social media posts point at real people, so they stay in the artifact and never ship in the plugin.
const PRIVATE_HOST = /(^|\.)(instagram\.com|instagr\.am|facebook\.com|tiktok\.com|threads\.net|x\.com|twitter\.com|pinterest\.[a-z.]+|reddit\.com|onlyfans\.com|patreon\.com)$/i;
// Only a full web address on a public site ships. A bare post code or a link without https:// is dropped too.
const isPrivateLink = u => { try { const x = new URL(u); return !/^https?:$/.test(x.protocol) || PRIVATE_HOST.test(x.hostname); } catch (e) { return true; } };
const frames = o.DATA.map(d => Object.fromEntries(keys.filter(k => d[k] !== undefined && !((k === "src" || k === "ex") && isPrivateLink(d[k]))).map(k => [k, d[k]])));
const tabs = Object.keys(o.TABNAME).map(id => ({ id, name: o.TABNAME[id], sets: o.ORDER[id] }));
// Traits that only the plugin has (like Age) are kept, at the end, so the Person node's dropdowns keep their order.
const old = (() => { try { return JSON.parse(fs.readFileSync(new URL("../web/poses.json", import.meta.url), "utf8")); } catch (e) { return { traits: [] }; } })();
const traits = o.TRAITS.map(([key, label, options]) => ({ key, label, options: options.map(([value, name]) => ({ value, name })) }));
for (const t of old.traits || []) if (!traits.some(x => x.key === t.key)) traits.push(t);
const out = {
  version: 1,
  updated: o.UPDATED,
  changelog: o.CHANGELOG.map(([date, text]) => ({ date, text })),
  tabs,
  sets: o.LABELS,
  traits,
  frames
};
fs.writeFileSync(new URL("../web/poses.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${frames.length} frames, ${tabs.length} tabs, updated ${o.UPDATED}`);
