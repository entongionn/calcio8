// Elementi dell'interfaccia usati da più viste.

import * as stato from '../stato.js';
import { archivioDaSeed } from '../archivio.js';
import { STAGIONE_2026_27 } from '../seed.js';
import { avvisa, esc } from '../util.js';

export function gironiCampionato(archivio) {
  return archivio.gironi.filter(g => g.competizione === 'campionato' && g.fase === 'fase1');
}

export function nomeSquadra(archivio, id) {
  return archivio.squadre.find(s => s.id === id)?.nome ?? id;
}

/** Schermata mostrata quando sul dispositivo non c'è ancora nessun dato. */
export function vistaBenvenuto(el) {
  el.innerHTML = `
    <h1>Benvenuto</h1>
    <section class="scheda">
      <p>Su questo dispositivo non ci sono ancora dati.</p>
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
