// Genera le icone PNG da app/icons/icon.svg con un browser in modalità headless:
//   node strumenti/genera_icone.mjs [percorso del browser]
// Default: Microsoft Edge su Windows. Va bene anche Chrome/Chromium.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const browser = process.argv[2] ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const svg = new URL('../app/icons/icon.svg', import.meta.url).href;
const profilo = mkdtempSync(join(tmpdir(), 'icone-'));
// Il browser headless non accetta finestre piccole: si disegna sempre a 512 e si riduce la scala.
for (const [nome, lato] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  const uscita = fileURLToPath(new URL(`../app/icons/${nome}`, import.meta.url));
  execFileSync(browser, [
    '--headless=new', `--user-data-dir=${profilo}`, '--hide-scrollbars', '--no-first-run',
    '--window-size=512,512', `--force-device-scale-factor=${lato / 512}`, `--screenshot=${uscita}`, svg,
  ], { stdio: 'ignore' });
  console.log('scritto', nome);
}
rmSync(profilo, { recursive: true, force: true });
