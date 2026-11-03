// Genera il logo dell'app (pallone con nastro tricolore) in SVG: node strumenti/genera_logo.mjs
//   app/icons/logo.svg  solo il simbolo, sfondo trasparente (intestazione dell'app)
//   app/icons/icon.svg  icona quadrata con sfondo (favicon e base per le icone PNG)
// Le icone PNG si ottengono dall'SVG con strumenti/genera_icone.mjs.
import { writeFileSync } from 'node:fs';

const C = { x: 256, y: 226 };
const R = 124;
const f = n => n.toFixed(1);
const punto = (cx, cy, r, gradi) => [cx + r * Math.cos((gradi * Math.PI) / 180), cy + r * Math.sin((gradi * Math.PI) / 180)];
const pentagono = (cx, cy, r, rotazione) =>
  Array.from({ length: 5 }, (_, k) => punto(cx, cy, r, rotazione + k * 72)).map(p => p.map(f).join(',')).join(' ');

// Pentagono centrale e cinque pentagoni sul bordo, tagliati dalla sfera.
const centrale = pentagono(C.x, C.y, 40, -90);
const direzioni = [-90, -18, 54, 126, 198];
const esterni = direzioni.map(a => {
  const [cx, cy] = punto(C.x, C.y, 112, a);
  return pentagono(cx, cy, 38, a + 180);
});
const cuciture = direzioni.map(a => {
  const [x1, y1] = punto(C.x, C.y, 40, a);
  const [x2, y2] = punto(C.x, C.y, 74, a);
  return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}).join('');

// Nastro tricolore che avvolge il pallone da sinistra in basso verso destra in alto.
const nastro = (dy, colore) => `<path d="M${76} ${f(342 + dy)}C${170} ${f(422 + dy)} ${340} ${f(410 + dy)} ${448} ${f(270 + dy)}" fill="none" stroke="${colore}" stroke-width="26" stroke-linecap="round"/>`;

const simbolo = `
  <defs>
    <radialGradient id="luce" cx="0.36" cy="0.3" r="0.85">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.7" stop-color="#e9e8f2"/>
      <stop offset="1" stop-color="#b9b6cc"/>
    </radialGradient>
    <clipPath id="sfera"><circle cx="${C.x}" cy="${C.y}" r="${R}"/></clipPath>
  </defs>
  ${nastro(-26, '#1f9d55')}
  ${nastro(0, '#ffffff')}
  ${nastro(26, '#e23b3b')}
  <circle cx="${C.x}" cy="${C.y}" r="${R}" fill="url(#luce)"/>
  <g clip-path="url(#sfera)">
    <path d="${cuciture}" stroke="#1b1726" stroke-width="7" stroke-linecap="round"/>
    <polygon points="${centrale}" fill="#1b1726"/>
    ${esterni.map(p => `<polygon points="${p}" fill="#1b1726"/>`).join('\n    ')}
  </g>
  <circle cx="${C.x}" cy="${C.y}" r="${R}" fill="none" stroke="#1b1726" stroke-opacity="0.25" stroke-width="3"/>`;

writeFileSync(new URL('../app/icons/logo.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 80 432 400">${simbolo}\n</svg>\n`);
writeFileSync(new URL('../app/icons/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a2a8c"/>
      <stop offset="1" stop-color="#0f0d1a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#fondo)"/>
  <g transform="translate(26 10) scale(0.9)">${simbolo}
  </g>
</svg>
`);
console.log('scritti app/icons/logo.svg e app/icons/icon.svg');
