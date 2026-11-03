import * as stato from '../stato.js';
import { analizzaCalendario, applicaCalendario, separaRighe, validaCalendario } from '../calendario.js';
import { totaleGiornate } from '../archivio.js';
import { testoDaPdf } from '../pdf.js';
import { avvisa, esc, formattaData } from '../util.js';
import { gironiCampionato, nomeSquadra, testata, vistaBenvenuto } from './comuni.js';

// Testo letto (dal PDF o incollato) e analisi in corso: sopravvivono ai ridisegni della vista.
// Il testo resta solo in memoria: dell'intero comunicato si salvano soltanto le partite.
let testo = '';
let fonte = '';
let analisi = null;
let soloAvvisi = false;

const ESITI = {
  nuova: ['nuova', 'Nuova'],
  modificata: ['modificata', 'Modificata'],
  invariata: ['invariata', 'Già presente'],
  errore: ['errore', 'Da correggere'],
};
const NOMI_CAMPI = { giornata: 'giornata', data: 'data', ora: 'ora', campo: 'campo' };

export function vistaCalendario(el) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  el.innerHTML = `
    ${testata('Importa calendario', '#/gestione')}
    <section class="scheda">
      <p>Carica il PDF del Comunicato Ufficiale: l'app legge il calendario e ti mostra le partite prima di importarle.
      Il resto del comunicato (regolamento, recapiti) viene ignorato e non viene salvato.</p>
      <div class="azioni">
        <label class="bottone primario">Carica PDF del comunicato<input type="file" id="file-pdf" accept="application/pdf,.pdf" hidden></label>
        ${analisi ? '<button class="collegamento" id="svuota">Ricomincia</button>' : ''}
      </div>
      <p class="nota" id="stato-pdf" role="status">${fonte ? `Letto da <strong>${esc(fonte)}</strong>` : ''}</p>
      <details ${testo && !fonte ? 'open' : ''}>
        <summary>${fonte ? 'Testo letto dal PDF' : 'Oppure incolla il testo'}</summary>
        <p class="nota">Puoi anche copiare il calendario dal PDF e incollarlo qui, anche se arriva tutto su una riga.</p>
        <label class="nascosta" for="testo-calendario">Testo del calendario</label>
        <textarea id="testo-calendario" rows="8" spellcheck="false" placeholder="Lun 26.10.2026 20.30 Petriccio SPORTING UOPINI vs CASTELLINA IN CHIANTI A">${esc(testo)}</textarea>
        <div class="azioni">
          <button class="secondario" id="analizza">Analizza il testo</button>
        </div>
      </details>
    </section>
    <div id="risultato"></div>`;

  const analizza = nuovoTesto => {
    // Il testo diviso in righe torna nel riquadro, così i numeri di riga degli avvisi corrispondono.
    testo = separaRighe(nuovoTesto).trim();
    analisi = testo ? analizzaCalendario(testo, a) : null;
    vistaCalendario(el);
    el.querySelector('#risultato').scrollIntoView({ behavior: 'smooth' });
  };

  el.querySelector('#file-pdf').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const statoPdf = el.querySelector('#stato-pdf');
    statoPdf.textContent = 'Lettura del PDF…';
    try {
      const letto = await testoDaPdf(file, { suAvanzamento: (n, tot) => { statoPdf.textContent = `Lettura del PDF: pagina ${n} di ${tot}…`; } });
      if (!letto.testo.trim()) throw new Error('il PDF non contiene testo (forse è una scansione)');
      fonte = `${file.name} (${letto.pagine} pagine)`;
      analizza(letto.testo);
    } catch (errore) {
      fonte = '';
      statoPdf.textContent = '';
      avvisa(`Impossibile leggere il PDF: ${errore.message}`, 'errore');
    }
  });
  el.querySelector('#analizza').addEventListener('click', () => {
    fonte = '';
    analizza(el.querySelector('#testo-calendario').value);
  });
  el.querySelector('#svuota')?.addEventListener('click', () => {
    testo = '';
    fonte = '';
    analisi = null;
    vistaCalendario(el);
  });
  if (analisi) mostraAnalisi(el, a);
}

function mostraAnalisi(el, a) {
  const contenitore = el.querySelector('#risultato');
  const righe = analisi.righe;
  if (!righe.length) {
    contenitore.innerHTML = '<div class="riquadro errore"><p>Nel testo non ho trovato righe di partita (formato atteso: «Lun 26.10.2026 20.30 Petriccio CASA vs OSPITE A»).</p></div>';
    return;
  }

  const conta = esito => righe.filter(r => r.esito === esito).length;
  const conSuggerimento = righe.filter(r => r.suggerimento && r.suggerimento !== r.giornata);
  const importabili = conta('nuova') + conta('modificata');
  const daMostrare = soloAvvisi ? righe.filter(r => r.avvisi.some(x => x.livello !== 'info') || r.esito === 'errore') : righe;

  const perGiornata = new Map();
  for (const r of daMostrare) {
    const k = r.giornata ?? 0;
    if (!perGiornata.has(k)) perGiornata.set(k, []);
    perGiornata.get(k).push(r);
  }

  contenitore.innerHTML = `
    <section class="scheda">
      <h2>Anteprima</h2>
      <ul class="conteggi">
        <li><span class="etichetta nuova">${conta('nuova')}</span> nuove</li>
        <li><span class="etichetta modificata">${conta('modificata')}</span> modificate</li>
        <li><span class="etichetta invariata">${conta('invariata')}</span> già presenti</li>
        <li><span class="etichetta errore">${conta('errore')}</span> da correggere</li>
      </ul>
      ${analisi.avvisiGenerali.length ? `
        <div class="riquadro attenzione"><ul>${analisi.avvisiGenerali.map(x => `<li>${esc(x.msg)}</li>`).join('')}</ul></div>` : ''}
      ${conSuggerimento.length ? `
        <div class="riquadro attenzione">
          <p>${conSuggerimento.length === 1 ? 'Una partita sembra assegnata' : `${conSuggerimento.length} partite sembrano assegnate`} alla giornata sbagliata.</p>
          <button class="secondario" id="applica-suggerimenti">Sposta nella giornata suggerita</button>
        </div>` : ''}
      <label class="scelta"><input type="checkbox" id="solo-avvisi" ${soloAvvisi ? 'checked' : ''}> Mostra solo le righe con avvisi</label>
      <p class="nota">Le righe da correggere non vengono importate. I risultati già inseriti non vengono mai modificati.</p>
    </section>

    ${[...perGiornata].sort((x, y) => x[0] - y[0]).map(([g, gruppo]) => `
      <h2 class="data">${g ? `${g}ª giornata` : 'Giornata non indicata'}</h2>
      <ul class="anteprima">
        ${gruppo.map(r => rigaAnteprima(r, a)).join('')}
      </ul>`).join('')}

    <div class="barra-conferma">
      <button class="primario" id="importa" ${importabili ? '' : 'disabled'}>
        ${importabili ? `Importa ${importabili} partit${importabili === 1 ? 'a' : 'e'}` : 'Niente da importare'}
      </button>
    </div>`;

  contenitore.querySelector('#solo-avvisi').addEventListener('change', e => {
    soloAvvisi = e.target.checked;
    mostraAnalisi(el, a);
  });
  contenitore.querySelector('#applica-suggerimenti')?.addEventListener('click', () => {
    for (const r of conSuggerimento) {
      r.giornata = r.suggerimento;
      r.giornataModificata = true;
    }
    validaCalendario(analisi, a);
    mostraAnalisi(el, a);
  });
  contenitore.querySelectorAll('[data-riga]').forEach(li => {
    const r = righe.find(x => String(x.riga) === li.dataset.riga);
    li.querySelector('[name="giornata"]').addEventListener('change', e => {
      const n = Number(e.target.value);
      if (!Number.isInteger(n) || n < 1) return;
      r.giornata = n;
      r.giornataModificata = true;
      validaCalendario(analisi, a);
      mostraAnalisi(el, a);
    });
    li.querySelectorAll('select[data-lato]').forEach(sel => sel.addEventListener('change', () => {
      r[sel.dataset.lato] = sel.value || null;
      r.riconoscimento[`${sel.dataset.lato}Manuale`] = true;
      validaCalendario(analisi, a);
      mostraAnalisi(el, a);
    }));
  });
  contenitore.querySelector('#importa').addEventListener('click', async () => {
    const { archivio, aggiunte, aggiornate } = applicaCalendario(stato.corrente(), righe);
    await stato.salva(archivio, { copiaPrima: 'Prima dell\'importazione del calendario' });
    testo = '';
    fonte = '';
    analisi = null;
    avvisa(`Calendario importato: ${aggiunte} partite aggiunte, ${aggiornate} aggiornate`);
    location.hash = '#/partite';
  });
}

function selettoreSquadra(a, r, lato) {
  const gironi = gironiCampionato(a);
  return `
    <select data-lato="${lato}" aria-label="Squadra ${lato === 'casa' ? 'di casa' : 'ospite'}">
      <option value="">— scegli —</option>
      ${gironi.map(g => `<optgroup label="${esc(g.nome)}">${g.squadre.map(id => `<option value="${esc(id)}"${id === r[lato] ? ' selected' : ''}>${esc(nomeSquadra(a, id))}</option>`).join('')}</optgroup>`).join('')}
    </select>`;
}

function rigaAnteprima(r, a) {
  const [classe, etichetta] = ESITI[r.esito];
  const squadraNonRiconosciuta = !r.casa || !r.ospite;
  const max = r.girone ? totaleGiornate(gironiCampionato(a).find(g => g.id === r.girone)) : 30;
  return `
    <li class="riga-anteprima" data-riga="${r.riga}">
      <div class="meta">
        ${r.data ? esc(formattaData(r.data)) : 'senza data'} · ${esc(r.ora)} · ${esc(r.campo)}
        ${r.girone ? `<span class="etichetta girone">${esc(r.girone)}</span>` : ''}
        <span class="etichetta ${classe}">${etichetta}</span>
      </div>
      <div class="squadre-anteprima">
        ${squadraNonRiconosciuta || r.riconoscimento.casaManuale ? selettoreSquadra(a, r, 'casa') : `<span>${esc(nomeSquadra(a, r.casa))}</span>`}
        <span aria-hidden="true">–</span>
        ${squadraNonRiconosciuta || r.riconoscimento.ospiteManuale ? selettoreSquadra(a, r, 'ospite') : `<span>${esc(nomeSquadra(a, r.ospite))}</span>`}
      </div>
      <label class="giornata-riga">Giornata
        <input name="giornata" type="number" inputmode="numeric" min="1" max="${max}" value="${r.giornata ?? ''}">
      </label>
      ${r.differenze?.length ? `<p class="nota">Cambia: ${r.differenze.map(d => `${NOMI_CAMPI[d.campo]} ${esc(d.prima ?? '—')} → ${esc(d.dopo ?? '—')}`).join(', ')}</p>` : ''}
      ${r.avvisi.length ? `<ul class="avvisi">${r.avvisi.map(x => `<li class="${x.livello}">${esc(x.msg)}</li>`).join('')}</ul>` : ''}
      <p class="testo-originale">Riga ${r.riga}: ${esc(r.testo)}</p>
    </li>`;
}
