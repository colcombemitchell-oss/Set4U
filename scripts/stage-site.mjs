import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = ['index.html', 'privacy.html', 'app.js', 'model.js', 'data.js', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icons'];

export async function stageSite(destination) {
  const output = resolve(destination);
  if (output === root || root.startsWith(output + '/')) throw new Error('Refusing to stage over source');
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length) throw new Error('Site staging destination must be empty');
  for (const asset of assets) await cp(join(root, asset), join(output, asset), { recursive: true, errorOnExist: true, force: false });
  await writeFile(join(output, '.nojekyll'), '', { flag: 'wx' });
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await stageSite(process.argv[2] || join(root, 'site-dist')));
}
