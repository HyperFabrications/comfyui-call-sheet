// Faint labels over a prompt box: which part of the shot each sentence is (subject, pose, clothes, setting, camera, light, look).
// Drawn on a see-through layer above the textarea, so the text itself never changes.

const CAM = /\b(shot|lens|close[- ]?up|top down|eye level|depth of field|full length|low angle|high angle|from above|from below|framing|framed|selfie)\b/i;
const LIGHT = /\b(light|lights|daylight|lit|lighting|flash|glow|glowing|sunlight|sun|shadow|shadows|backlit|backlight|lamp|lamps|neon|candlelight|overcast|sky)\b/i;
const FINISH = /\b(palette|finish|grain|film|tones|contrast|color|colors|monochrome|matte|saturated|desaturated)\b/i;
const WEARING = /^(wearing|she wears|she is wearing)\b/i;
const BODY = /^(she|her|hair|his|one|both|arms?|hands?|eyes|head|lips|legs|knees|feet|bare|seen from)\b/i;
const KEY = "kps:labels";

// [{at, label}] where at is a character offset into text.
export function labelsFor(text) {
  const out = [], sents = [];
  const re = /[^.]+(?:\.|$)/g;
  let m;
  while ((m = re.exec(text))) {
    if (!m[0].trim()) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
    sents.push({ at: m.index + (m[0].length - m[0].trimStart().length), s: m[0].trim() });
  }
  if (!sents.length) return out;
  let cam = sents.findIndex((x, i) => i > 0 && CAM.test(x.s));
  if (cam < 0) cam = sents.length;
  sents.forEach((x, i) => {
    if (i === 0) {
      const c = x.s.indexOf(",");
      if (c > 0 && c < x.s.length - 2) {
        out.push({ at: x.at, label: "subject" });
        const rest = x.s.slice(c + 1), lead = rest.length - rest.trimStart().length;
        out.push({ at: x.at + c + 1 + lead, label: "pose" });
      } else out.push({ at: x.at, label: "subject, pose" });
      return;
    }
    let label;
    if (WEARING.test(x.s)) label = "clothes";
    else if (i < cam) label = BODY.test(x.s) ? "pose" : "setting";
    else if (i === cam) label = "camera";
    else { const l = LIGHT.test(x.s), f = FINISH.test(x.s); label = l && f ? "light, look" : l ? "light" : "look"; }
    out.push({ at: x.at, label });
  });
  return out;
}

export const labelsOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch (e) { return true; } };
const setOn = v => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const COPY = ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "tabSize", "textIndent", "wordSpacing"];

// Attach labels to a textarea. Returns {refresh, toggle, on} so the caller can wire a button.
export function attachLabels(ta) {
  if (!ta || ta._kqLabels) return ta && ta._kqLabels;
  const wrap = document.createElement("div");
  wrap.className = "kq-lwrap";
  ta.parentNode.insertBefore(wrap, ta);
  wrap.appendChild(ta);
  const layer = document.createElement("div");
  layer.className = "kq-llayer";
  layer.setAttribute("aria-hidden", "true");
  wrap.appendChild(layer);
  let on = labelsOn();
  const draw = () => {
    ta.classList.toggle("kq-labeled", on);
    layer.hidden = !on;
    if (!on) return;
    const cs = getComputedStyle(ta);
    for (const k of COPY) layer.style[k] = cs[k];
    layer.style.width = ta.offsetWidth + "px";
    layer.style.height = ta.offsetHeight + "px";
    // The textarea's scrollbar narrows its text; match it so lines wrap in the same places.
    layer.style.paddingRight = (parseFloat(cs.paddingRight) + (ta.offsetWidth - ta.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth))) + "px";
    const text = ta.value, marks = labelsFor(text);
    let html = "", pos = 0;
    for (const mk of marks) {
      html += esc(text.slice(pos, mk.at)) + `<span class="kq-lmark"><i>${esc(mk.label)}</i></span>`;
      pos = mk.at;
    }
    layer.innerHTML = html + esc(text.slice(pos)) + "\n";
    layer.scrollTop = ta.scrollTop;
  };
  ta.addEventListener("input", draw);
  ta.addEventListener("scroll", () => { layer.scrollTop = ta.scrollTop; });
  if (window.ResizeObserver) new ResizeObserver(draw).observe(ta);
  const api = {
    refresh: draw,
    get on() { return on; },
    toggle() { on = !on; setOn(on); draw(); return on; },
  };
  ta._kqLabels = api;
  requestAnimationFrame(draw);
  return api;
}
