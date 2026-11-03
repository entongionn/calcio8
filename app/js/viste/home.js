import * as stato from '../stato.js';
import { partitaConta } from '../classifica.js';
import { esc, formattaDataOra } from '../util.js';
import { ICONE, rigaPartita, vistaBenvenuto } from './comuni.js';

const STATI_PUBBLICAZIONE = {
  ok: 'Dati pubblicati',
  'in-corso': 'Pubblicazione in corso…',
  'da-pubblicare': 'Modifiche da pubblicare',
  errore: 'Pubblicazione non riuscita',
};

export function vistaHome(el) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);
  el.classList.add('a-tutta-pagina');

  const campionato = a.partite.filter(p => p.competizione === 'campionato');
  const giocate = campionato.filter(partitaConta);
  // Ultimi risultati: la giornata più recente con almeno un risultato.
  const ultimaGiornata = Math.max(0, ...giocate.map(p => p.giornata));
  const ultimi = giocate.filter(p => p.giornata === ultimaGiornata)
    .sort((x, y) => `${y.data}${y.ora}`.localeCompare(`${x.data}${x.ora}`));
  const prossime = campionato.filter(p => p.stato === 'programmata' && p.data)
    .sort((x, y) => `${x.data}${x.ora}`.localeCompare(`${y.data}${y.ora}`))
    .slice(0, 4);
  const pub = stato.statoPubblicazione();

  el.innerHTML = `
    <section class="eroe">
      <div class="marchio">
        <img src="icons/logo.svg" alt="" width="52" height="48">
        <div><strong>AICS Siena</strong><span>Calcio a 8</span></div>
      </div>
      <div>
        <h1>Campionato<br>AICS Siena</h1>
        <p class="categoria">Calcio a 8</p>
        <span class="pillola">Stagione ${esc((a.stagione?.id ?? '2026-27').replace('-', '/'))}</span>
      </div>
    </section>

    <div class="corpo-home">
      <nav class="riquadri" aria-label="Sezioni">
        <a href="#/classifiche">${ICONE.classifica}Classifica</a>
        <a href="#/partite">${ICONE.calendario}Calendario</a>
        <a href="#/partite/${ultimaGiornata || ''}">${ICONE.risultati}Risultati</a>
        <a href="#/squadre">${ICONE.squadre}Squadre</a>
        <a href="#/marcatori">${ICONE.marcatori}Marcatori</a>
        <a href="#/novita">${ICONE.novita}Novità</a>
      </nav>

      ${stato.isAmministratore() ? `
        <p class="stato-pubblicazione" data-stato="${pub.stato}">
          ${STATI_PUBBLICAZIONE[pub.stato]}${pub.stato === 'ok' && pub.quando ? ` alle ${esc(formattaDataOra(pub.quando).split(', ')[1] ?? '')}` : ''}
        </p>` : ''}

      ${ultimi.length ? `
        <section>
          <div class="scheda-titolo"><h2>Ultimi risultati</h2><a href="#/partite/${ultimaGiornata}">Vedi tutti →</a></div>
          <div class="scheda">
            <p class="etichetta-giornata">Giornata ${ultimaGiornata}</p>
            <ul class="righe-partite">${ultimi.map(p => rigaPartita(a, p)).join('')}</ul>
          </div>
        </section>` : ''}

      ${prossime.length ? `
        <section>
          <div class="scheda-titolo"><h2>Prossime partite</h2><a href="#/partite">Calendario →</a></div>
          <div class="scheda">
            <ul class="righe-partite">${prossime.map(p => rigaPartita(a, p)).join('')}</ul>
          </div>
        </section>` : ''}
    </div>`;
}
