import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const read = (path) => readFile(resolve(root, path), "utf8");

test("the web app manifest is installable and every icon exists", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));

  await Promise.all(
    manifest.icons.map((icon) => access(resolve(root, icon.src.replace(/^\.\//, ""))))
  );
});

test("all local assets linked by the page exist and use GitHub Pages-safe relative paths", async () => {
  const html = await read("index.html");
  const refs = [...html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)].map((match) => match[1]);

  assert.ok(refs.includes("./manifest.webmanifest?v=4"));
  assert.ok(refs.includes("./app.js?v=4"));
  assert.ok(refs.includes("./styles.css?v=4"));
  assert.equal(/(?:href|src)="\//.test(html), false);

  await Promise.all(
    refs.map((ref) => access(resolve(root, ref.replace(/^\.\//, "").split("?")[0])))
  );
});

test("the service worker pre-caches the complete offline app shell", async () => {
  const worker = await read("sw.js");
  const required = [
    "./index.html",
    "./styles.css?v=4",
    "./app.js?v=4",
    "./model.js?v=4",
    "./data.js?v=4",
    "./manifest.webmanifest?v=4",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/maskable-512.png",
    "./icons/apple-touch-icon.png"
  ];

  required.forEach((asset) => assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("the Pages workflow runs checks before deploying with current official actions", async () => {
  const workflow = await read(".github/workflows/pages.yml");

  assert.match(workflow, /needs: test/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /npm run check/);
});

test("the private Performance Sheet supports text upload and adjustable auto-scroll", async () => {
  const html = await read("index.html");
  const app = await read("app.js");

  assert.match(html, /Performance sheet/);
  assert.match(html, /accept="\.txt,\.md,text\/plain,text\/markdown"/);
  assert.doesNotMatch(html, /Lyrics or chords|song-lyrics/);
  assert.match(app, /requestAnimationFrame/);
  assert.match(app, /Start auto-scroll/);
  assert.match(app, /Pause auto-scroll/);
  assert.match(app, /sheetScrollSpeed/);
});

test("mobile header actions use matching icon controls", async () => {
  const html = await read("index.html");
  const css = await read("styles.css");

  assert.match(html, /id="install-button"[\s\S]*?<svg[\s\S]*?<span>Install<\/span>/);
  assert.match(html, /id="settings-button"[\s\S]*?<svg/);
  assert.match(css, /#install-button span[\s\S]*?display: none/);
  assert.match(css, /#install-button\s*\{[\s\S]*?width: 42px/);
});

test("public-facing copy presents Set4U as a personal app for any user", async () => {
  const html = await read("index.html");
  const app = await read("app.js");

  assert.match(html, /Your set\. Your show\./);
  assert.match(html, /ready-made Set 1, Set 2 and Spares examples/);
  assert.match(app, /Ready for your next gig/);
  assert.doesNotMatch(`${html}\n${app}`, /Mitch|original two sets/i);
});

