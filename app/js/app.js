// Avvio dell'app: caricamento dei dati, navigazione tra le viste, service worker.

import * as stato from './stato.js';
import * as backup from './backup.js';
import { avvisa, esc } from './util.js';
import { vistaClassifiche } from './viste/classifiche.js';
import { vistaPartite } from './viste/partite.js';
import { vistaGestione } from './viste/gestione.js';
import { vistaCalendario } from './viste/calendario.js';
import { vistaSquadre } from './viste/squadre.js';
import { vistaFacebook } from './viste/facebook.js';
import { vistaMarcatori } from './viste/marcatori.js';

// Vista → [funzione, scheda della barra di navigazione]
const VISTE = {
  classifiche: [vistaClassifiche, 'classifiche'],
  partite: [vistaPartite, 'partite'],
  marcatori: [vistaMarcatori, 'marcatori'],
  gestione: [vistaGestione, 'gestione'],
  calendario: [vistaCalendario, 'gestione'],
  squadre: [vistaSquadre, 'gestione'],
  facebook: [vistaFacebook, 'gestione'],
};

function rotta() {
  const [nome, ...param] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return VISTE[nome] ? { nome, param } : { nome: 'classifiche', param: [] };
}

let ultimaRotta = null;

async function disegna() {
  const { nome, param } = rotta();
  const [vista, scheda] = VISTE[nome];
  document.querySelectorAll('.barra-nav a').forEach(a => {
    if (a.dataset.scheda === scheda) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const main = document.querySelector('#contenuto');
  const chiaveRotta = location.hash;
  try {
    await vista(main, param);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="riquadro errore"><p><strong>Si è verificato un errore.</strong></p><p>${esc(e.message)}</p></div>`;
  }
  if (chiaveRotta !== ultimaRotta) {
    window.scrollTo(0, 0);
    ultimaRotta = chiaveRotta;
  }
  aggiornaBanner();
}

async function aggiornaBanner() {
  const banner = document.querySelector('#banner');
  if (stato.isVolatile()) {
    banner.innerHTML = '<p>Questo browser non permette di salvare i dati (navigazione privata?). Le modifiche andranno perse alla chiusura: esporta un backup.</p>';
    banner.hidden = false;
    return;
  }
  if (await backup.serveBackup()) {
    banner.innerHTML = '<p>Ci sono modifiche non comprese in nessun backup. <button class="collegamento" id="backup-ora">Scarica backup</button></p>';
    banner.querySelector('#backup-ora').addEventListener('click', async () => {
      if (await backup.esporta('scarica')) avvisa('Backup scaricato');
      aggiornaBanner();
    });
    banner.hidden = false;
    return;
  }
  banner.hidden = true;
}

async function avvia() {
  try {
    await stato.carica();
  } catch (e) {
    console.error(e);
    avvisa(`Impossibile leggere i dati salvati: ${e.message}`, 'errore');
  }
  stato.ascolta(() => disegna());
  window.addEventListener('hashchange', disegna);
  await disegna();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker non registrato', e));
  }
}

avvia();
