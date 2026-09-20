import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, writeFile, rm, symlink, readlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './local-config.mjs';

if (process.platform !== 'darwin') throw new Error('The desktop launcher requires macOS. Use npm --prefix blog run open instead.');
const app = path.join(os.homedir(), 'Applications/Write Blog.app');
const desktop = path.join(os.homedir(), 'Desktop/Write Blog.app');
await mkdir(path.dirname(app), { recursive: true });
if (await access(app).then(() => true, () => false)) throw new Error(`${app} already exists. Move it aside before reinstalling.`);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const command = `${quote(process.execPath)} ${quote(path.join(repoRoot, 'blog/scripts/launch.mjs'))}`;
const temporary = await mkdtemp(path.join(os.tmpdir(), 'write-blog-app-'));
try {
  const source = path.join(temporary, 'launcher.applescript');
  await writeFile(source, `on run\n  try\n    do shell script ${JSON.stringify(command)}\n  on error errorMessage\n    display dialog errorMessage with title "Write Blog" buttons {"OK"} default button "OK" with icon caution\n  end try\nend run\n`);
  await promisify(execFile)('/usr/bin/osacompile', ['-o', app, source]);
  await symlink(app, desktop).catch(async error => {
    if (error.code === 'EEXIST' && await readlink(desktop).catch(() => '') === app) return;
    if (error.code === 'EEXIST') { console.log('An item named Write Blog already exists on the Desktop; it was left unchanged.'); return; }
    throw error;
  });
  console.log(`Installed ${app}\nDouble-click Write Blog on your Desktop, or drag it to your Dock.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
