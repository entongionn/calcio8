import * as stato from '../stato.js';
import { classificaMarcatori, golNonAttribuiti } from '../marcatori.js';
import { avatar } from '../stemmi.js';
import { esc } from '../util.js';
import { gironiCampionato, nomeSquadra, stemmaSquadra, testata, vistaBenvenuto } from './comuni.js';

/** Riga della classifica marcatori: posizione, avatar, nome e squadra, gol. */
export function rigaMarcatore(a, r) {
  return `
    <li>
      <span class="posizione">${r.pos}</span>
      ${avatar(r.nome, r.squadra)}
      <span class="chi">
        <strong>${esc(r.nome)}</strong>
        <span>${stemmaSquadra(a, r.squadra, 16)}${esc(nomeSquadra(a, r.squadra))}</span>
      </span>
      <span class="gol">${r.gol}${r.provvisori ? '<sup>*</sup>' : ''}</span>
    </li>`;
}

export function vistaMarcatori(el, [gironeId = 'tutti']) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  const gironi = gironiCampionato(a);
  const girone = gironi.find(g => g.id === gironeId) ?? null;
  const squadre = girone ? girone.squadre : gironi.flatMap(g => g.squadre);
  const righe = classificaMarcatori(a, squadre);
  const senzaMarcatore = golNonAttribuiti(a, squadre);
  const provvisori = righe.some(r => r.provvisori);

  el.innerHTML = `
    ${testata('Classifica marcatori')}
    <nav class="segmenti" aria-label="Gironi">
      <a href="#/marcatori/tutti" ${!girone ? 'aria-current="page"' : ''}>Tutti</a>
      ${gironi.map(g => `<a href="#/marcatori/${g.id}" ${girone?.id === g.id ? 'aria-current="page"' : ''}>Girone ${esc(g.id)}</a>`).join('')}
    </nav>
    ${righe.length ? `
      <section class="scheda" style="margin-top:14px">
        <ol class="elenco-marcatori">${righe.map(r => rigaMarcatore(a, r)).join('')}</ol>
      </section>
      ${provvisori ? '<p class="nota">* Comprende gol da risultati provvisori, non ancora confermati dal Comunicato Ufficiale.</p>' : ''}
      ${senzaMarcatore ? `<p class="nota">${senzaMarcatore} gol senza marcatore indicato non sono conteggiati.</p>` : ''}`
    : `
      <section class="scheda" style="margin-top:14px">
        <p>Nessun marcatore ancora.</p>
      </section>`}`;
}
