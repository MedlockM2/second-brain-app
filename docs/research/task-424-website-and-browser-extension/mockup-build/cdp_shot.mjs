// Screenshots through the Chrome DevTools Protocol, so that the viewport is exactly the
// one asked for: Chrome's --window-size cannot go under 500 px wide, which would turn a
// "390 px" capture into a 500 px layout cropped at 390.
// Usage: node --experimental-websocket cdp_shot.mjs <jobs.json>
//   jobs.json: [{ "url": "file://…#…", "out": "…png", "width": 390, "height": 844, "scale": 2, "mobile": true }]
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "cdp-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await send("Page.enable");
for (const j of jobs) {
  await send("Emulation.setDeviceMetricsOverride", { width: j.width, height: j.height, deviceScaleFactor: j.scale || 1, mobile: !!j.mobile });
  await send("Page.navigate", { url: "about:blank" });
  await send("Page.navigate", { url: j.url });
  await sleep(700);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(j.out, Buffer.from(shot.result.data, "base64"));
  const w = await send("Runtime.evaluate", { expression: "innerWidth + 'x' + innerHeight + ' scrollW=' + document.documentElement.scrollWidth", returnByValue: true });
  console.log(" ", j.out.split("/").slice(-2).join("/"), w.result.result.value);
}
ws.close();
chrome.kill();
