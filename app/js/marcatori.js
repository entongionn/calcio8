// Classifica marcatori dalle partite con eventi. Le autoreti non contano, e nemmeno i gol
// delle partite date vinte a tavolino.

import { partitaConta } from './classifica.js';

/**
 * @param {object} archivio
 * @param {string[]|null} [squadre] limita alle squadre indicate (es. quelle di un girone)
 * @returns {{ pos, giocatore, nome, squadra, gol, provvisori }[]} provvisori = gol da risultati non ancora ufficiali
 */
export function classificaMarcatori(archivio, squadre = null) {
  const giocatori = new Map((archivio.giocatori ?? []).map(g => [g.id, g]));
  const righe = new Map();
  for (const p of archivio.partite) {
    if (!partitaConta(p) || p.stato === 'tavolino' || !p.eventi) continue;
    for (const m of p.eventi.marcatori ?? []) {
      if (m.autorete || !m.giocatore) continue;
      const g = giocatori.get(m.giocatore);
      const squadra = g?.squadra ?? m.squadra;
      if (squadre && !squadre.includes(squadra)) continue;
      if (!righe.has(m.giocatore)) righe.set(m.giocatore, { giocatore: m.giocatore, nome: g?.nome ?? m.giocatore, squadra, gol: 0, provvisori: 0 });
      const r = righe.get(m.giocatore);
      r.gol += m.gol;
      if (!p.ufficiale) r.provvisori += m.gol;
    }
  }
  const ordinate = [...righe.values()].sort((a, b) => b.gol - a.gol || a.nome.localeCompare(b.nome, 'it'));
  // A pari gol, stessa posizione.
  ordinate.forEach((r, i) => { r.pos = i > 0 && ordinate[i - 1].gol === r.gol ? ordinate[i - 1].pos : i + 1; });
  return ordinate;
}

/** Gol senza marcatore nelle partite considerate, per squadra. */
export function golNonAttribuiti(archivio, squadre = null) {
  let totale = 0;
  for (const p of archivio.partite) {
    if (!partitaConta(p) || p.stato === 'tavolino' || !p.eventi?.nonAttribuiti) continue;
    if (!squadre || squadre.includes(p.casa)) totale += p.eventi.nonAttribuiti.casa ?? 0;
    if (!squadre || squadre.includes(p.ospite)) totale += p.eventi.nonAttribuiti.ospite ?? 0;
  }
  return totale;
}
