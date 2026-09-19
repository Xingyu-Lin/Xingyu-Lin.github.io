import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({ entryPoints: [fileURLToPath(new URL('../admin/editor.mjs', import.meta.url))], outfile: fileURLToPath(new URL('../admin/editor.bundle.js', import.meta.url)), bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'linked' });
