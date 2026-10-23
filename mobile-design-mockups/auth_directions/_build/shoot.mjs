// Renders screen.png (whole page) for each mockup directory through the Chrome DevTools Protocol.
// Usage (from the repository root): node mobile-design-mockups/auth_directions/_build/shoot.mjs [frames-dir]
// With frames-dir, also writes one PNG per phone / browser frame there, for review.
// DIRS=a,b limits the run to those directories.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALL = ["comparatif", "direction_a_epuree", "direction_b_une_seule_porte", "direction_c_vitrine", "direction_d_sans_mot_de_passe", "direction_c_finale"];
const DIRS = process.env.DIRS ? process.env.DIRS.split(",") : ALL;
const FRAMES = process.argv[2];
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "cdp-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.result.value;

await send("Page.enable");
if (FRAMES) mkdirSync(FRAMES, { recursive: true });
for (const dir of DIRS) {
  const width = 1500;
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `file://${join(ROOT, dir, "code.html")}` });
  await sleep(800);
  const height = await evaluate("document.documentElement.scrollHeight");
  // Chrome cannot capture past ~16 000 device pixels: a taller page is captured at a smaller scale.
  const scale = Math.min(1, 16000 / height);
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
  await sleep(300);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(ROOT, dir, "screen.png"), Buffer.from(shot.result.data, "base64"));
  console.log(dir, `${width}x${height}`, scale < 1 ? `(scale ${scale.toFixed(2)})` : "");
  if (FRAMES && dir !== "comparatif") {
    const rects = await evaluate(`[...document.querySelectorAll('.phone,.desk')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})`);
    for (const [i, [x, y, w, h]] of rects.entries()) {
      const s = await send("Page.captureScreenshot", { format: "png", clip: { x, y, width: w, height: h, scale: 1 / scale } });
      writeFileSync(join(FRAMES, `${dir}-${String(i + 1).padStart(2, "0")}.png`), Buffer.from(s.result.data, "base64"));
    }
  }
}
ws.close(); chrome.kill();
