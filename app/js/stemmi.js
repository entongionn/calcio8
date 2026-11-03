// Stemmi delle squadre e avatar dei giocatori, disegnati in SVG.
// I colori sono quelli sociali comunicati nel CUF 2 (tabella dei recapiti, colonna "colore maglia");
// per le squadre che non li hanno comunicati si usa una tinta neutra ricavata dal nome.

import { esc } from './util.js';

const COLORI = {
  'atletico-menta': ['#d7263d'],
  'avis-asta-taverne': ['#d7263d', '#1f4fd1'],
  'borussia-robur': ['#f6c90e', '#16161a'],
  'sienterina': ['#8c1c3c'],
  'monteroni': ['#3b9ae1'],
  'sporting-uopini': ['#d7263d', '#1f9d55'],
  'terre-di-siena': ['#b3202a'],
  'vico-alto': ['#ffffff', '#1f4fd1'],
  'artico-senese': ['#1f3fa6', '#ffffff'],
  'sant-andrea': ['#7cc6f2', '#1f3fa6'],
  'warriors': ['#f6c90e', '#1f3fa6'],
  'lornano': ['#ffffff'],
  'ponte-d-arbia': ['#7cc6f2'],
};

const PAROLE_VUOTE = new Set(['i', 'il', 'lo', 'la', 'le', 'gli', 'di', 'd', 'in', 'to', 'the', 'fc', 'asd']);

function tintaDaNome(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 30% 42%)`;
}

export function coloriSquadra(id) {
  return COLORI[id] ?? [tintaDaNome(id)];
}

// Luminosità approssimativa per scegliere il colore delle iniziali.
function chiaro(colore) {
  if (!colore.startsWith('#')) return false;
  const n = parseInt(colore.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}

export function iniziali(nome) {
  const parole = String(nome).replace(/['’]/g, ' ').split(/\s+/).filter(p => p && !PAROLE_VUOTE.has(p.toLowerCase()));
  if (!parole.length) return '?';
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}

const SCUDO = 'M20 2 L37 7 V21 C37 32 29.5 40 20 44 C10.5 40 3 32 3 21 V7 Z';
let contatore = 0;

/** Stemma SVG della squadra. */
export function stemma(id, nome, dimensione = 28) {
  const [c1, c2 = c1] = coloriSquadra(id);
  const clip = `scudo-${++contatore}`;
  const testo = chiaro(c1) && chiaro(c2) ? '#14121c' : '#ffffff';
  return `<svg class="stemma" width="${dimensione}" height="${Math.round(dimensione * 1.15)}" viewBox="0 0 40 46" role="img" aria-label="${esc(nome)}">
    <defs><clipPath id="${clip}"><path d="${SCUDO}"/></clipPath></defs>
    <g clip-path="url(#${clip})">
      <rect width="40" height="46" fill="${c1}"/>
      ${c2 !== c1 ? `<rect x="20" width="20" height="46" fill="${c2}"/>` : '<rect x="20" width="20" height="46" fill="#000" opacity="0.12"/>'}
    </g>
    <path d="${SCUDO}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
    <text x="20" y="27" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, sans-serif"
      fill="${testo}" stroke="${testo === '#ffffff' ? 'rgba(10,8,20,0.85)' : 'none'}" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke">${esc(iniziali(nome))}</text>
  </svg>`;
}

/** Avatar rotondo con le iniziali del giocatore, nel colore della squadra. */
export function avatar(nome, squadra) {
  const [c1] = coloriSquadra(squadra);
  const parti = String(nome).split(/\s+/).filter(Boolean);
  // I nomi sono scritti "Cognome Nome": iniziali di nome e cognome.
  const sigla = parti.length > 1 ? `${parti[parti.length - 1][0]}${parti[0][0]}` : (parti[0] ?? '?').slice(0, 2);
  return `<span class="avatar${chiaro(c1) ? ' chiaro' : ''}" style="--colore:${c1}" aria-hidden="true">${esc(sigla.toUpperCase())}</span>`;
}
