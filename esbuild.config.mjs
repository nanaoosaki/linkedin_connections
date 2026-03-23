import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

// Bundle content script
await esbuild.build({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  outfile: 'dist/content.js',
  format: 'iife',
  target: 'chrome100',
});

// Bundle popup
await esbuild.build({
  entryPoints: ['src/popup/index.ts'],
  bundle: true,
  outfile: 'dist/popup.js',
  format: 'iife',
  target: 'chrome100',
});

// Copy static files
copyFileSync('manifest.json', 'dist/manifest.json');
copyFileSync('popup.html',    'dist/popup.html');
copyFileSync('assets/icon-16.png',  'dist/icon-16.png');
copyFileSync('assets/icon-48.png',  'dist/icon-48.png');
copyFileSync('assets/icon-128.png', 'dist/icon-128.png');

console.log('Build complete.');
