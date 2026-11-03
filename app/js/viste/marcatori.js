import * as stato from '../stato.js';
import { classificaMarcatori, golNonAttribuiti } from '../marcatori.js';
import { esc } from '../util.js';
import { gironiCampionato, nomeSquadra, vistaBenvenuto } from './comuni.js';

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
    <h1>Marcatori</h1>
    <nav class="segmenti" aria-label="Gironi">
      <a href="#/marcatori/tutti" ${!girone ? 'aria-current="page"' : ''}>Tutti</a>
      ${gironi.map(g => `<a href="#/marcatori/${g.id}" ${girone?.id === g.id ? 'aria-current="page"' : ''}>${esc(g.id)}</a>`).join('')}
    </nav>
    ${righe.length ? `
      <p class="sottotitolo">
        ${provvisori ? '<span class="etichetta provvisorio">Comprende gol da risultati provvisori</span>' : 'Dati ufficiali'}
      </p>
      <div class="tabella-contenitore">
        <table class="classifica marcatori">
          <thead>
            <tr><th class="pos" scope="col">#</th><th class="sq" scope="col">Giocatore</th><th scope="col">Gol</th></tr>
          </thead>
          <tbody>
            ${righe.map(r => `
              <tr>
                <td class="pos">${r.pos}</td>
                <th class="sq" scope="row">${esc(r.nome)}<span class="squadra-marcatore">${esc(nomeSquadra(a, r.squadra))}</span></th>
                <td class="pt">${r.gol}${r.provvisori ? '<sup>*</sup>' : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${provvisori ? '<p class="nota">* Almeno una parte dei gol viene da post Facebook non ancora confermati dal Comunicato Ufficiale.</p>' : ''}
      ${senzaMarcatore ? `<p class="nota">${senzaMarcatore} gol senza marcatore indicato non sono conteggiati.</p>` : ''}`
    : `
      <section class="scheda">
        <p>Nessun marcatore ancora.</p>
        <p class="nota">I marcatori arrivano dai post Facebook (Gestione → Importa post Facebook) e, in seguito, dai Comunicati Ufficiali.</p>
      </section>`}`;
}
