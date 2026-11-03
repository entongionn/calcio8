// Elementi dell'interfaccia usati da più viste.

import * as stato from '../stato.js';
import { archivioDaSeed } from '../archivio.js';
import { STAGIONE_2026_27 } from '../seed.js';
import { stemma } from '../stemmi.js';
import { avvisa, esc, formattaData } from '../util.js';

export const ICONE = {
  classifica: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/></svg>',
  calendario: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  risultati: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20v-6h3v6M10.5 20V9h3v11M15 20V4h3v16"/></svg>',
  squadre: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/></svg>',
  marcatori: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l-4 3 2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.7-2 3-4 3S8.5 4.7 8 3z"/></svg>',
  novita: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
  altro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  gestione: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  telefono: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  chiave: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/></svg>',
};

export function gironiCampionato(archivio) {
  return archivio.gironi.filter(g => g.competizione === 'campionato' && g.fase === 'fase1');
}

export function nomeSquadra(archivio, id) {
  return archivio.squadre.find(s => s.id === id)?.nome ?? id;
}

export function stemmaSquadra(archivio, id, dimensione) {
  return stemma(id, nomeSquadra(archivio, id), dimensione);
}

/** Intestazione delle pagine interne: freccia indietro e titolo centrato. */
export function testata(titolo, indietro = '#/') {
  return `
    <header class="testata">
      <a class="indietro" href="${indietro}" aria-label="Indietro">‹</a>
      <h1>${esc(titolo)}</h1>
      <span></span>
    </header>`;
}

/** Riga compatta di una partita: stemma, nome, risultato (o data e ora), nome, stemma. */
export function rigaPartita(archivio, p) {
  const centro = p.gol
    ? `<span class="risultato">${p.gol.casa} - ${p.gol.ospite}</span>`
    : `<span class="orario">${p.data ? esc(formattaData(p.data)) : 'da definire'}<br>${esc(p.ora ?? '')}</span>`;
  return `
    <li>
      ${stemmaSquadra(archivio, p.casa, 24)}
      <span class="nome">${esc(nomeSquadra(archivio, p.casa))}</span>
      ${centro}
      <span class="nome ospite">${esc(nomeSquadra(archivio, p.ospite))}</span>
      ${stemmaSquadra(archivio, p.ospite, 24)}
    </li>`;
}

/** Schermata mostrata quando sul dispositivo non c'è ancora nessun dato. */
export function vistaBenvenuto(el) {
  if (!stato.isAmministratore()) {
    el.innerHTML = `
      <h1>Calcio a 8</h1>
      <section class="scheda">
        <p>I dati del campionato non sono ancora disponibili su questo telefono.</p>
        <p class="nota">Servono una connessione a Internet al primo avvio: poi l'app funziona anche offline.</p>
        <div class="azioni"><button class="primario" id="riprova">Riprova</button></div>
      </section>`;
    el.querySelector('#riprova').addEventListener('click', () => stato.sincronizza());
    return;
  }
  el.innerHTML = `
    <h1>Benvenuto</h1>
    <section class="scheda">
      <p>Non ci sono ancora dati pubblicati.</p>
      <p>Puoi creare la stagione con le squadre e i gironi del Comunicato Ufficiale n.1, oppure ripristinare un backup.</p>
      <div class="azioni">
        <button class="primario" id="crea-stagione">Crea stagione 2026–2027</button>
        <a class="bottone" href="#/gestione">Ripristina un backup</a>
      </div>
    </section>`;
  el.querySelector('#crea-stagione').addEventListener('click', async () => {
    await stato.salva(archivioDaSeed(STAGIONE_2026_27));
    avvisa('Stagione creata. Ora importa il calendario.');
    location.hash = '#/calendario';
  });
}

/**
 * Apre una finestra di dialogo con il contenuto indicato. `collega(dialog, chiudi)` aggancia
 * gli eventi; la finestra viene rimossa alla chiusura.
 */
export function apriDialogo(html, collega) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialogo';
  dialog.innerHTML = html;
  document.body.append(dialog);
  const chiudi = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', e => {
    if (e.target === dialog) chiudi();
  });
  collega(dialog, chiudi);
  dialog.showModal();
  return dialog;
}

export function opzioniSquadre(archivio, ids, selezionata) {
  return ids.map(id => `<option value="${esc(id)}"${id === selezionata ? ' selected' : ''}>${esc(nomeSquadra(archivio, id))}</option>`).join('');
}
