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

  assert.ok(refs.includes("./manifest.webmanifest"));
  assert.ok(refs.includes("./app.js"));
  assert.ok(refs.includes("./styles.css"));
  assert.equal(/(?:href|src)="\//.test(html), false);

  await Promise.all(refs.map((ref) => access(resolve(root, ref.replace(/^\.\//, "")))));
});

test("the service worker pre-caches the complete offline app shell", async () => {
  const worker = await read("sw.js");
  const required = [
    "./index.html",
    "./styles.css",
    "./app.js",
    "./model.js",
    "./data.js",
    "./manifest.webmanifest",
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
