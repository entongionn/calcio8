import * as stato from '../stato.js';
import { analizzaPost, applicaPost, validaPost } from '../facebook.js';
import { avvisa, esc } from '../util.js';
import { nomeSquadra, testata, vistaBenvenuto } from './comuni.js';

// Testo incollato e post in revisione: sopravvivono ai ridisegni della vista.
let testo = '';
let posts = [];

const ESITI = {
  nuovo: ['nuova', 'Da salvare'],
  aggiorna: ['modificata', 'Aggiorna'],
  uguale: ['invariata', 'Già salvato'],
  ufficiale: ['errore', 'Già ufficiale'],
  errore: ['errore', 'Da correggere'],
  riepilogo: ['invariata', 'Riepilogo'],
};
const salvabile = p => p.esito === 'nuovo' || p.esito === 'aggiorna';

// Salvataggio automatico dei post senza avvisi: preferenza di questo telefono.
const CHIAVE_AUTOMATICO = 'aics-salvataggio-automatico';
function automatico() {
  try {
    return localStorage.getItem(CHIAVE_AUTOMATICO) !== 'no';
  } catch {
    return true;
  }
}

// Testo ricevuto da un'altra app con "Condividi" (Android), in attesa di essere analizzato.
let testoCondiviso = null;
export function riceviTestoCondiviso(t) {
  testoCondiviso = t;
}

/** Analizza il testo e, se attivo, salva subito le partite che non hanno avvisi. */
async function analizzaEImporta(el, nuovoTesto) {
  testo = nuovoTesto;
  const a = stato.corrente();
  posts = testo.trim() ? analizzaPost(testo, a) : [];
  if (testo.trim() && !posts.length) {
    avvisa('Nel testo non ho trovato risultati di partite', 'errore');
  } else if (automatico()) {
    const pronti = posts.filter(p => salvabile(p) && !p.avvisi.some(x => x.livello !== 'info'));
    if (pronti.length) await salva(pronti);
    const daVedere = posts.filter(salvabile).length;
    if (daVedere) setTimeout(() => avvisa(`${daVedere === 1 ? 'Una partita ha' : `${daVedere} partite hanno`} avvisi: controlla e salva`), 4200);
  }
  vistaFacebook(el);
  el.querySelector('#post')?.scrollIntoView({ behavior: 'smooth' });
}

export function vistaFacebook(el) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);
  if (testoCondiviso) {
    const t = testoCondiviso;
    testoCondiviso = null;
    analizzaEImporta(el, t);
    return;
  }
  const daSalvare = posts.filter(salvabile).length;
  const puoiIncollare = Boolean(navigator.clipboard?.readText);

  el.innerHTML = `
    ${testata('Post Facebook', '#/altro')}
    <section class="scheda">
      <p>Su Facebook tieni premuto sul testo del post e scegli <strong>Copia</strong>, poi torna qui.
      I risultati diventano <strong>provvisori</strong> finché non arriva il Comunicato Ufficiale, e vengono pubblicati per tutti.</p>
      ${puoiIncollare ? '<button class="primario" id="incolla" style="width:100%">Incolla dagli appunti e importa</button>' : ''}
      <label class="scelta"><input type="checkbox" id="automatico" ${automatico() ? 'checked' : ''}> Salva da solo le partite senza avvisi</label>
      <details ${testo || !puoiIncollare ? 'open' : ''}>
        <summary>${puoiIncollare ? 'Oppure incolla a mano' : 'Incolla il testo'}</summary>
        <label class="nascosta" for="testo-post">Testo dei post</label>
        <textarea id="testo-post" rows="7" placeholder="1^ GIORNATA - GIRONE B&#10;Artico Senese - Avis Asta Taverne 3-2&#10;Per l'Artico Senese reti di …">${esc(testo)}</textarea>
        <div class="azioni">
          <button class="secondario" id="analizza">Analizza</button>
          ${posts.length ? '<button class="collegamento" id="svuota">Ricomincia</button>' : ''}
        </div>
      </details>
    </section>
    <div id="post">${posts.map(p => schedaPost(p, a)).join('')}</div>
    ${daSalvare > 1 ? `
      <div class="barra-conferma">
        <button class="primario" id="salva-tutti">Salva ${daSalvare} partite</button>
      </div>` : ''}`;

  el.querySelector('#incolla')?.addEventListener('click', async () => {
    let letto = '';
    try {
      letto = await navigator.clipboard.readText();
    } catch {
      avvisa('Non riesco a leggere gli appunti: incolla il testo a mano', 'errore');
      el.querySelector('details').open = true;
      return;
    }
    if (!letto.trim()) return avvisa('Gli appunti sono vuoti: copia prima il testo del post', 'errore');
    analizzaEImporta(el, letto);
  });
  el.querySelector('#automatico').addEventListener('change', e => {
    try {
      localStorage.setItem(CHIAVE_AUTOMATICO, e.target.checked ? 'si' : 'no');
    } catch {
      // Preferenza non memorizzabile: vale solo per questa sessione.
    }
  });
  el.querySelector('#analizza').addEventListener('click', () => analizzaEImporta(el, el.querySelector('#testo-post').value));
  el.querySelector('#svuota')?.addEventListener('click', () => {
    testo = '';
    posts = [];
    vistaFacebook(el);
  });
  el.querySelector('#salva-tutti')?.addEventListener('click', () => salva(posts.filter(salvabile)));

  const contenitore = el.querySelector('#post');
  contenitore.addEventListener('change', e => {
    // I campi di testo non ridisegnano la scheda, per non perdere il campo su cui si sta scrivendo:
    // i post vengono comunque ricontrollati prima del salvataggio.
    const ridisegna = modifica(e.target);
    if (ridisegna) rivaluta(el);
  });
  contenitore.addEventListener('click', e => {
    const b = e.target.closest('button[data-azione]');
    if (!b) return;
    const p = posts[Number(b.closest('[data-post]').dataset.post)];
    const { azione, elenco, indice } = b.dataset;
    if (azione === 'salva') return salva([p]);
    if (azione === 'togli') p[elenco].splice(Number(indice), 1);
    if (azione === 'aggiungi') {
      p[elenco].push(elenco === 'marcatori'
        ? { nome: '', gol: 1, autorete: false, rigore: false, squadraTesto: null, squadraGol: p.casa, squadraManuale: true }
        : { nome: '', squadraTesto: null, squadraIndicata: p.casa, squadraManuale: true });
    }
    rivaluta(el);
  });
}

// Applica al post la modifica fatta in un campo della scheda. Restituisce true se serve ridisegnare.
function modifica(campo) {
  const scheda = campo.closest('[data-post]');
  if (!scheda) return false;
  const p = posts[Number(scheda.dataset.post)];
  const { elenco, indice, prop } = campo.dataset;
  const valore = campo.type === 'checkbox' ? campo.checked : campo.value;

  if (!elenco) {
    if (prop === 'golCasa' || prop === 'golOspite') {
      const n = Number(valore);
      if (!Number.isInteger(n) || n < 0) return false;
      p.gol = { ...(p.gol ?? { casa: 0, ospite: 0 }), [prop === 'golCasa' ? 'casa' : 'ospite']: n };
    } else if (prop === 'casa' || prop === 'ospite') {
      p[prop] = valore || null;
      p[`${prop}Manuale`] = true;
    } else if (prop === 'arbitro') {
      p.arbitro = valore.trim() || null;
      return false;
    }
    return true;
  }
  const voce = p[elenco][Number(indice)];
  if (prop === 'nome') {
    voce.nome = valore.trim();
    return false;
  }
  if (prop === 'gol') {
    const n = Number(valore);
    if (!Number.isInteger(n) || n < 1) return false;
    voce.gol = n;
  }
  if (prop === 'autorete') voce.autorete = valore;
  if (prop === 'squadra') {
    voce[elenco === 'marcatori' ? 'squadraGol' : 'squadraIndicata'] = valore || null;
    voce.squadraManuale = true;
  }
  return true;
}

function rivaluta(el) {
  const a = stato.corrente();
  for (const p of posts) validaPost(p, a);
  vistaFacebook(el);
}

async function salva(daSalvare) {
  let a = stato.corrente();
  let salvati = 0;
  for (const p of daSalvare) {
    // Ricontrollo: i nomi possono essere stati modificati senza ridisegnare la scheda.
    validaPost(p, a);
    if (!salvabile(p)) continue;
    a = applicaPost(a, p);
    salvati++;
  }
  if (!salvati) {
    rivaluta(document.querySelector('#contenuto'));
    return avvisa('Controlla gli avvisi: nessuna partita salvata', 'errore');
  }
  // I post vanno ricontrollati prima di salvare: il salvataggio ridisegna subito la vista,
  // e quelli salvati devono risultare "già salvati".
  for (const p of posts) validaPost(p, a);
  await stato.salva(a, { copiaPrima: 'Prima dell\'importazione di post Facebook' });
  avvisa(salvati === 1 ? 'Partita salvata (provvisoria)' : `${salvati} partite salvate (provvisorie)`);
}

function opzioniDue(a, p, selezionata) {
  return [p.casa, p.ospite].filter(Boolean)
    .map(id => `<option value="${esc(id)}"${id === selezionata ? ' selected' : ''}>${esc(nomeSquadra(a, id))}</option>`).join('');
}

function selettoreSquadra(a, p, prop) {
  return `
    <select data-prop="${prop}" aria-label="Squadra ${prop === 'casa' ? 'di casa' : 'ospite'}">
      <option value="">— scegli —</option>
      ${a.squadre.map(s => `<option value="${esc(s.id)}"${s.id === p[prop] ? ' selected' : ''}>${esc(s.nome)}</option>`).join('')}
    </select>`;
}

function elencoPersone(a, p, elenco, titolo) {
  const squadraDi = x => (elenco === 'marcatori' ? x.squadraGol : x.squadraIndicata);
  return `
    <fieldset class="elenco-post">
      <legend>${titolo}</legend>
      ${p[elenco].map((x, i) => `
        <div class="voce-post">
          <input data-elenco="${elenco}" data-indice="${i}" data-prop="nome" value="${esc(x.nome)}" aria-label="Nome" placeholder="Cognome Nome">
          ${elenco === 'marcatori' ? `<input class="numero" data-elenco="${elenco}" data-indice="${i}" data-prop="gol" type="number" inputmode="numeric" min="1" max="20" value="${x.gol}" aria-label="Gol">` : ''}
          <select data-elenco="${elenco}" data-indice="${i}" data-prop="squadra" aria-label="${elenco === 'marcatori' ? 'Gol a favore di' : 'Squadra'}">
            <option value="">— squadra —</option>${opzioniDue(a, p, squadraDi(x))}
          </select>
          <button type="button" class="icona-piccola" data-azione="togli" data-elenco="${elenco}" data-indice="${i}" aria-label="Togli ${esc(x.nome)}">×</button>
          ${elenco === 'marcatori' ? `<label class="scelta piccola"><input type="checkbox" data-elenco="${elenco}" data-indice="${i}" data-prop="autorete" ${x.autorete ? 'checked' : ''}> autorete</label>` : ''}
        </div>`).join('')}
      <button type="button" class="collegamento" data-azione="aggiungi" data-elenco="${elenco}">+ Aggiungi</button>
    </fieldset>`;
}

function schedaPost(p, a) {
  const [classe, etichetta] = ESITI[p.esito];
  const titolo = [p.giornata ? `${p.giornata}ª giornata` : null, p.girone ? `Girone ${p.girone}` : p.gironeIntestazione ? `Girone ${p.gironeIntestazione}` : null]
    .filter(Boolean).join(' · ');
  // Partita già salvata: basta una riga di riepilogo.
  if (p.esito === 'uguale') {
    return `
      <section class="scheda post" data-post="${p.indice}">
        <div class="meta">${esc(titolo || 'Partita')} <span class="etichetta ufficiale">Salvata</span></div>
        <p style="margin:8px 0 0"><strong>${esc(nomeSquadra(a, p.casa))} ${p.gol.casa} – ${p.gol.ospite} ${esc(nomeSquadra(a, p.ospite))}</strong></p>
      </section>`;
  }
  if (p.riepilogo) {
    return `
      <section class="scheda post" data-post="${p.indice}">
        <div class="meta"><span class="etichetta ${classe}">${etichetta}</span></div>
        <p class="nota">${esc(p.avvisi[0].msg)}</p>
      </section>`;
  }
  return `
    <section class="scheda post" data-post="${p.indice}">
      <div class="meta">${esc(titolo || 'Partita')} <span class="etichetta ${classe}">${etichetta}</span></div>
      <div class="risultato-post">
        ${p.casa && !p.casaManuale ? `<strong>${esc(nomeSquadra(a, p.casa))}</strong>` : selettoreSquadra(a, p, 'casa')}
        <span class="gol-post">
          <input class="numero" data-prop="golCasa" type="number" inputmode="numeric" min="0" max="99" value="${p.gol?.casa ?? ''}" aria-label="Gol casa">
          –
          <input class="numero" data-prop="golOspite" type="number" inputmode="numeric" min="0" max="99" value="${p.gol?.ospite ?? ''}" aria-label="Gol ospite">
        </span>
        ${p.ospite && !p.ospiteManuale ? `<strong>${esc(nomeSquadra(a, p.ospite))}</strong>` : selettoreSquadra(a, p, 'ospite')}
      </div>
      ${p.avvisi.length ? `<ul class="avvisi">${p.avvisi.map(x => `<li class="${x.livello}">${esc(x.msg)}</li>`).join('')}</ul>` : ''}
      ${elencoPersone(a, p, 'marcatori', 'Marcatori')}
      ${elencoPersone(a, p, 'ammoniti', 'Ammoniti')}
      ${elencoPersone(a, p, 'espulsi', 'Espulsi')}
      <label>Arbitro <input data-prop="arbitro" value="${esc(p.arbitro ?? '')}"></label>
      <details><summary>Testo originale</summary><p class="testo-originale">${p.righe.map(esc).join('<br>')}</p></details>
      <div class="azioni">
        <button class="primario" data-azione="salva" ${salvabile(p) ? '' : 'disabled'}>${p.esito === 'aggiorna' ? 'Aggiorna partita' : 'Salva partita'}</button>
      </div>
    </section>`;
}
