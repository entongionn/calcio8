// Avvio dell'app: caricamento dei dati, allineamento con quelli pubblicati, navigazione, service worker.

import * as stato from './stato.js';
import { avvisa, esc } from './util.js';
import { vistaHome } from './viste/home.js';
import { vistaClassifiche } from './viste/classifiche.js';
import { vistaPartite } from './viste/partite.js';
import { vistaMarcatori } from './viste/marcatori.js';
import { vistaElencoSquadre, vistaSquadra } from './viste/squadre-pubbliche.js';
import { vistaNovita } from './viste/novita.js';
import { vistaAltro, vistaInstalla } from './viste/altro.js';
import { vistaGestione } from './viste/gestione.js';
import { vistaCalendario } from './viste/calendario.js';
import { vistaSquadre as vistaAlias } from './viste/squadre.js';
import { riceviTestoCondiviso, vistaFacebook } from './viste/facebook.js';

// Vista → [funzione, scheda della barra di navigazione, solo per l'amministratore]
const VISTE = {
  home: [vistaHome, 'home'],
  classifiche: [vistaClassifiche, 'classifica'],
  marcatori: [vistaMarcatori, 'classifica'],
  partite: [vistaPartite, 'calendario'],
  squadre: [vistaElencoSquadre, 'squadre'],
  squadra: [vistaSquadra, 'squadre'],
  novita: [vistaNovita, 'altro'],
  altro: [vistaAltro, 'altro'],
  installa: [vistaInstalla, 'altro'],
  gestione: [vistaGestione, 'altro', true],
  calendario: [vistaCalendario, 'altro', true],
  alias: [vistaAlias, 'altro', true],
  facebook: [vistaFacebook, 'altro', true],
};

function rotta() {
  const [nome, ...param] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return VISTE[nome] ? { nome, param } : { nome: 'home', param: [] };
}

let ultimaRotta = null;

async function disegna() {
  let { nome, param } = rotta();
  // Le pagine di gestione sono riservate al telefono dell'amministratore.
  if (VISTE[nome][2] && !stato.isAmministratore()) ({ nome, param } = { nome: 'altro', param: [] });
  const [vista, scheda] = VISTE[nome];
  document.querySelectorAll('.barra-nav a').forEach(a => {
    if (a.dataset.scheda === scheda) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const main = document.querySelector('#contenuto');
  main.className = '';
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

function aggiornaBanner() {
  const banner = document.querySelector('#banner');
  const pub = stato.statoPubblicazione();
  if (stato.isVolatile()) {
    banner.innerHTML = '<p>Questo browser non permette di salvare i dati (navigazione privata?): servirà la connessione a ogni apertura.</p>';
    banner.hidden = false;
  } else if (stato.isAmministratore() && pub.stato === 'errore') {
    banner.innerHTML = `<p>Pubblicazione non riuscita (${esc(pub.errore)}): le modifiche sono salvate su questo telefono. <button class="collegamento" id="riprova-pubblica">Riprova</button></p>`;
    banner.querySelector('#riprova-pubblica').addEventListener('click', async () => {
      if (await stato.pubblicaOra()) avvisa('Dati pubblicati');
    });
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

// Testo condiviso da un'altra app (Android, "Condividi" → Calcio a 8): va all'importazione dei post.
function leggiCondivisione() {
  const parametri = new URLSearchParams(location.search);
  const testo = [parametri.get('title'), parametri.get('text'), parametri.get('url')].filter(Boolean).join('\n');
  if (!testo) return;
  history.replaceState(null, '', location.pathname);
  riceviTestoCondiviso(testo);
  location.hash = '#/facebook';
}

async function avvia() {
  try {
    await stato.carica();
  } catch (e) {
    console.error(e);
    avvisa(`Impossibile leggere i dati salvati: ${e.message}`, 'errore');
  }
  leggiCondivisione();
  stato.ascolta(() => disegna());
  stato.ascoltaPubblicazione(() => {
    aggiornaBanner();
    const { nome } = rotta();
    if (nome === 'home' || nome === 'altro') disegna();
  });
  window.addEventListener('hashchange', disegna);
  await disegna();

  // Dati pubblicati: all'avvio, al ritorno della connessione e quando l'app torna in primo piano.
  const allinea = () => stato.sincronizza().catch(e => console.warn('Sincronizzazione non riuscita', e));
  allinea();
  window.addEventListener('online', allinea);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') allinea();
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker non registrato', e));
  }
}

avvia();
