/**
 * Zips the dist/ folder into linkedin-connections-exporter.zip
 * ready for upload to the Chrome Web Store.
 *
 * Uses only Node built-ins — no extra dependencies required.
 * On Windows: delegates to PowerShell's Compress-Archive.
 * On macOS/Linux: uses the zip CLI.
 */

import { execSync } from 'child_process';
import { rmSync, existsSync } from 'fs';
import { platform } from 'os';

const OUT = 'linkedin-connections-exporter.zip';

if (existsSync(OUT)) rmSync(OUT);

if (platform() === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path dist\\* -DestinationPath ${OUT}"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd dist && zip -r ../${OUT} .`, { stdio: 'inherit' });
}

console.log(`\nPacked: ${OUT}`);
console.log('Upload this file at: https://chrome.google.com/webstore/devconsole');
