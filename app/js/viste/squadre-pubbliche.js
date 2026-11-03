import * as stato from '../stato.js';
import { calcolaClassifica, partitaConta } from '../classifica.js';
import { classificaMarcatori } from '../marcatori.js';
import { nomiSquadre } from '../archivio.js';
import { esc } from '../util.js';
import { gironiCampionato, nomeSquadra, rigaPartita, stemmaSquadra, testata, vistaBenvenuto } from './comuni.js';
import { rigaMarcatore } from './marcatori.js';

function classificaGirone(a, girone) {
  return calcolaClassifica({
    squadre: girone.squadre,
    partite: a.partite.filter(p => p.girone === girone.id),
    penalita: a.penalita.filter(p => p.girone === girone.id),
    sorteggio: a.sorteggi?.[girone.id] ?? [],
    nomi: nomiSquadre(a),
  });
}

export function vistaElencoSquadre(el) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  el.innerHTML = `
    ${testata('Squadre')}
    ${gironiCampionato(a).map(g => {
      const righe = classificaGirone(a, g).righe;
      return `
      <section class="scheda">
        <h2>${esc(g.nome)}</h2>
        <ul class="elenco-squadre">
          ${[...righe].sort((x, y) => nomeSquadra(a, x.squadra).localeCompare(nomeSquadra(a, y.squadra), 'it')).map(r => `
            <li><a href="#/squadra/${esc(r.squadra)}">
              ${stemmaSquadra(a, r.squadra, 30)}
              <strong>${esc(nomeSquadra(a, r.squadra))}</strong>
              <span class="dettaglio">${r.pos}° · ${r.punti} pt</span>
            </a></li>`).join('')}
        </ul>
      </section>`;
    }).join('')}`;
}

export function vistaSquadra(el, [id]) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);
  const girone = gironiCampionato(a).find(g => g.squadre.includes(id));
  if (!girone) {
    el.innerHTML = `${testata('Squadra', '#/squadre')}<section class="scheda"><p>Squadra non trovata.</p></section>`;
    return;
  }
  const riga = classificaGirone(a, girone).righe.find(r => r.squadra === id);
  const partite = a.partite.filter(p => p.competizione === 'campionato' && (p.casa === id || p.ospite === id));
  const giocate = partite.filter(partitaConta).sort((x, y) => y.giornata - x.giornata);
  const prossime = partite.filter(p => p.stato === 'programmata').sort((x, y) => x.giornata - y.giornata);
  const marcatori = classificaMarcatori(a, [id]);

  el.innerHTML = `
    ${testata(girone.nome, '#/squadre')}
    <div class="testa-squadra">
      ${stemmaSquadra(a, id, 56)}
      <div>
        <h1>${esc(nomeSquadra(a, id))}</h1>
        <span class="nota">${riga.pos}° posto · ${riga.punti} punti</span>
      </div>
    </div>
    <div class="numeri">
      <div><strong>${riga.giocate}</strong><span>giocate</span></div>
      <div><strong>${riga.v}-${riga.n}-${riga.p}</strong><span>V-N-P</span></div>
      <div><strong>${riga.rf}:${riga.rs}</strong><span>reti</span></div>
      <div><strong>${riga.dr > 0 ? '+' : ''}${riga.dr}</strong><span>diff. reti</span></div>
    </div>
    ${giocate.length ? `
      <section class="scheda">
        <h2>Risultati</h2>
        <ul class="righe-partite">${giocate.map(p => rigaPartita(a, p)).join('')}</ul>
      </section>` : ''}
    ${prossime.length ? `
      <section class="scheda">
        <h2>Prossime partite</h2>
        <ul class="righe-partite">${prossime.slice(0, 5).map(p => rigaPartita(a, p)).join('')}</ul>
      </section>` : ''}
    ${marcatori.length ? `
      <section class="scheda">
        <h2>Marcatori</h2>
        <ol class="elenco-marcatori">${marcatori.map(r => rigaMarcatore(a, r)).join('')}</ol>
      </section>` : ''}`;
}
