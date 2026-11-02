import * as stato from '../stato.js';
import { idPartita, STATI_PARTITA, totaleGiornate } from '../archivio.js';
import { avvisa, esc, formattaData, uid } from '../util.js';
import { apriDialogo, gironiCampionato, nomeSquadra, opzioniSquadre, vistaBenvenuto } from './comuni.js';

// Giornata da mostrare all'apertura: quella della prima partita ancora da giocare.
function giornataCorrente(partite, giornate) {
  const prossime = partite.filter(p => p.stato === 'programmata')
    .sort((x, y) => (x.data ?? '9999').localeCompare(y.data ?? '9999'));
  return prossime[0]?.giornata ?? giornate[giornate.length - 1];
}

function etichettaStato(p) {
  if (p.stato === 'giocata') return p.ufficiale ? ['ufficiale', 'Ufficiale'] : ['provvisorio', 'Provvisorio'];
  if (p.stato === 'tavolino') return ['tavolino', 'A tavolino'];
  if (p.stato === 'rinviata') return ['rinviata', 'Rinviata'];
  if (p.stato === 'annullata') return ['annullata', 'Annullata'];
  return null;
}

export function vistaPartite(el, [giornataParam, filtro = 'tutti']) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  const gironi = gironiCampionato(a);
  const campionato = a.partite.filter(p => p.competizione === 'campionato');
  if (!campionato.length) {
    el.innerHTML = `
      <h1>Partite</h1>
      <section class="scheda">
        <p>Non ci sono ancora partite.</p>
        <div class="azioni">
          <a class="bottone primario" href="#/calendario">Importa il calendario</a>
          <button class="secondario" id="nuova">Aggiungi una partita</button>
        </div>
      </section>`;
    el.querySelector('#nuova').addEventListener('click', () => dialogoPartita(null, {}));
    return;
  }

  const giornate = [...new Set(campionato.map(p => p.giornata))].sort((x, y) => x - y);
  let g = Number(giornataParam);
  if (!giornate.includes(g)) g = giornataCorrente(campionato, giornate);
  const i = giornate.indexOf(g);
  const visibili = campionato
    .filter(p => p.giornata === g && (filtro === 'tutti' || p.girone === filtro))
    .sort((x, y) => `${x.data ?? '9999'}${x.ora ?? ''}${x.girone}`.localeCompare(`${y.data ?? '9999'}${y.ora ?? ''}${y.girone}`));

  const perData = new Map();
  for (const p of visibili) {
    const k = p.data ?? '';
    if (!perData.has(k)) perData.set(k, []);
    perData.get(k).push(p);
  }

  const riposi = gironi
    .filter(gi => filtro === 'tutti' || gi.id === filtro)
    .flatMap(gi => {
      const qui = campionato.filter(p => p.girone === gi.id && p.giornata === g);
      if (!qui.length) return [];
      const giocano = new Set(qui.flatMap(p => [p.casa, p.ospite]));
      return gi.squadre.filter(s => !giocano.has(s)).map(s => ({ girone: gi, squadra: s }));
    });

  const link = (giornata, f = filtro) => `#/partite/${giornata}/${f}`;

  el.innerHTML = `
    <h1>Partite</h1>
    <div class="navigatore">
      <a class="bottone icona" href="${i > 0 ? link(giornate[i - 1]) : '#'}" ${i > 0 ? '' : 'aria-disabled="true"'} aria-label="Giornata precedente">‹</a>
      <select id="giornata" aria-label="Giornata">
        ${giornate.map(x => `<option value="${x}"${x === g ? ' selected' : ''}>${x}ª giornata</option>`).join('')}
      </select>
      <a class="bottone icona" href="${i < giornate.length - 1 ? link(giornate[i + 1]) : '#'}" ${i < giornate.length - 1 ? '' : 'aria-disabled="true"'} aria-label="Giornata successiva">›</a>
    </div>
    <nav class="segmenti piccoli" aria-label="Filtro girone">
      <a href="${link(g, 'tutti')}" ${filtro === 'tutti' ? 'aria-current="page"' : ''}>Tutti</a>
      ${gironi.map(gi => `<a href="${link(g, gi.id)}" ${filtro === gi.id ? 'aria-current="page"' : ''}>${esc(gi.id)}</a>`).join('')}
    </nav>

    ${[...perData].map(([data, partite]) => `
      <h2 class="data">${data ? esc(formattaData(data)) : 'Data da definire'}</h2>
      <ul class="partite">
        ${partite.map(p => {
          const st = etichettaStato(p);
          return `
          <li>
            <button class="partita" data-id="${esc(p.id)}">
              <span class="meta">
                ${esc(p.ora ?? '')}${p.campo ? ` · ${esc(p.campo)}` : ''}
                <span class="etichetta girone">${esc(p.girone)}</span>
                ${p.recupero ? '<span class="etichetta">recupero</span>' : ''}
                ${st ? `<span class="etichetta ${st[0]}">${st[1]}</span>` : ''}
              </span>
              <span class="squadre">
                <span class="casa">${esc(nomeSquadra(a, p.casa))}</span>
                <span class="punteggio${p.gol ? '' : ' vuoto'}">${p.gol ? `${p.gol.casa} – ${p.gol.ospite}` : '–'}</span>
                <span class="ospite">${esc(nomeSquadra(a, p.ospite))}</span>
              </span>
            </button>
          </li>`;
        }).join('')}
      </ul>`).join('')}

    ${riposi.length ? `<p class="nota">${riposi.map(r => `${esc(r.girone.nome)}: riposa ${esc(nomeSquadra(a, r.squadra))}`).join(' · ')}</p>` : ''}
    <div class="azioni">
      <button class="secondario" id="nuova">Aggiungi una partita</button>
    </div>`;

  el.querySelector('#giornata').addEventListener('change', e => { location.hash = link(e.target.value); });
  el.querySelectorAll('a[aria-disabled="true"]').forEach(x => x.addEventListener('click', e => e.preventDefault()));
  el.querySelectorAll('.partita').forEach(b => b.addEventListener('click', () => {
    dialogoPartita(a.partite.find(p => p.id === b.dataset.id));
  }));
  el.querySelector('#nuova').addEventListener('click', () => dialogoPartita(null, { giornata: g, girone: filtro !== 'tutti' ? filtro : gironi[0].id }));
}

function leggiGol(valore) {
  if (valore === '') return null;
  const n = Number(valore);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/** Modifica di una partita esistente (`partita`) o inserimento di una nuova (`partita` null). */
function dialogoPartita(partita, predefiniti = {}) {
  const a = stato.corrente();
  const nuova = !partita;
  const gironi = gironiCampionato(a);
  const p = partita ?? {
    girone: predefiniti.girone ?? gironi[0].id, giornata: predefiniti.giornata ?? 1,
    casa: null, ospite: null, data: null, ora: null, campo: null, stato: 'programmata', gol: null, ufficiale: false,
  };
  const penalitaRinuncia = a.penalita.find(x => x.partita === p.id);
  const squadreGirone = gid => gironi.find(x => x.id === gid).squadre;
  const casaNome = nuova ? '' : esc(nomeSquadra(a, p.casa));
  const ospiteNome = nuova ? '' : esc(nomeSquadra(a, p.ospite));

  apriDialogo(`
    <form method="dialog" novalidate>
      <h2>${nuova ? 'Nuova partita' : `${casaNome} – ${ospiteNome}`}</h2>
      ${nuova ? `
        <label>Girone
          <select name="girone">${gironi.map(gi => `<option value="${gi.id}"${gi.id === p.girone ? ' selected' : ''}>${esc(gi.nome)}</option>`).join('')}</select>
        </label>
        <div class="due-colonne">
          <label>Casa <select name="casa">${opzioniSquadre(a, squadreGirone(p.girone))}</select></label>
          <label>Ospite <select name="ospite">${opzioniSquadre(a, squadreGirone(p.girone), squadreGirone(p.girone)[1])}</select></label>
        </div>` : ''}

      <label>Stato
        <select name="stato">
          ${Object.entries(STATI_PARTITA).map(([k, v]) => `<option value="${k}"${k === p.stato ? ' selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>

      <fieldset data-se="programmata giocata" class="risultato">
        <legend>Risultato</legend>
        <div class="gol">
          <label><span>${nuova ? 'Casa' : casaNome}</span><input name="golCasa" type="number" inputmode="numeric" min="0" max="99" value="${p.gol?.casa ?? ''}"></label>
          <span aria-hidden="true">–</span>
          <label><span>${nuova ? 'Ospite' : ospiteNome}</span><input name="golOspite" type="number" inputmode="numeric" min="0" max="99" value="${p.gol?.ospite ?? ''}"></label>
        </div>
      </fieldset>

      <fieldset data-se="tavolino">
        <legend>Vittoria a tavolino (3–0)</legend>
        <label class="scelta"><input type="radio" name="vincitore" value="casa" ${!p.gol || p.gol.casa >= p.gol.ospite ? 'checked' : ''}> Vince ${nuova ? 'la squadra di casa' : casaNome}</label>
        <label class="scelta"><input type="radio" name="vincitore" value="ospite" ${p.gol && p.gol.ospite > p.gol.casa ? 'checked' : ''}> Vince ${nuova ? 'la squadra ospite' : ospiteNome}</label>
        <label class="scelta"><input type="checkbox" name="rinuncia" ${penalitaRinuncia ? 'checked' : ''}> Rinuncia: −1 punto in classifica alla squadra perdente</label>
      </fieldset>

      <label class="scelta" data-se="giocata tavolino"><input type="checkbox" name="ufficiale" ${p.ufficiale ? 'checked' : ''}> Confermato dal Comunicato Ufficiale</label>

      <details ${nuova ? 'open' : ''}>
        <summary>Giornata, data e campo</summary>
        <div class="due-colonne">
          <label>Giornata <input name="giornata" type="number" inputmode="numeric" min="1" value="${p.giornata ?? ''}"></label>
          <label>Campo <input name="campo" list="elenco-campi" value="${esc(p.campo ?? '')}"></label>
          <label>Data <input name="data" type="date" value="${esc(p.data ?? '')}"></label>
          <label>Ora <input name="ora" type="time" value="${esc(p.ora ?? '')}"></label>
        </div>
        <datalist id="elenco-campi">${(a.campi ?? []).map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      </details>

      <p class="errore" role="alert" hidden></p>
      <div class="azioni">
        ${nuova ? '' : '<button type="button" class="pericolo" data-elimina>Elimina</button>'}
        <button type="button" class="secondario" data-annulla>Annulla</button>
        <button type="submit" class="primario">Salva</button>
      </div>
    </form>`, (dialog, chiudi) => {
    const form = dialog.querySelector('form');
    const errore = dialog.querySelector('.errore');
    const aggiornaVisibilita = () => {
      const st = form.stato.value;
      dialog.querySelectorAll('[data-se]').forEach(x => { x.hidden = !x.dataset.se.split(' ').includes(st); });
    };
    aggiornaVisibilita();
    form.stato.addEventListener('change', () => {
      aggiornaVisibilita();
      if (form.stato.value === 'giocata') form.golCasa.focus();
    });
    if (nuova) {
      form.girone.addEventListener('change', () => {
        const ids = squadreGirone(form.girone.value);
        form.casa.innerHTML = opzioniSquadre(a, ids);
        form.ospite.innerHTML = opzioniSquadre(a, ids, ids[1]);
      });
    }
    dialog.querySelector('[data-annulla]').addEventListener('click', chiudi);
    dialog.querySelector('[data-elimina]')?.addEventListener('click', async () => {
      if (!confirm(`Eliminare la partita ${nomeSquadra(a, p.casa)} – ${nomeSquadra(a, p.ospite)}? Verrà salvata una copia di sicurezza.`)) return;
      await stato.modifica(arch => {
        arch.partite = arch.partite.filter(x => x.id !== p.id);
        arch.penalita = arch.penalita.filter(x => x.partita !== p.id);
      }, { copiaPrima: `Prima dell'eliminazione di ${nomeSquadra(a, p.casa)} – ${nomeSquadra(a, p.ospite)}` });
      chiudi();
      avvisa('Partita eliminata');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const mostra = msg => { errore.textContent = msg; errore.hidden = false; };
      let st = form.stato.value;
      // Scrivere il risultato di una partita da giocare equivale a segnarla come giocata.
      if (st === 'programmata' && (form.golCasa.value !== '' || form.golOspite.value !== '')) st = 'giocata';
      const girone = nuova ? form.girone.value : p.girone;
      const casa = nuova ? form.casa.value : p.casa;
      const ospite = nuova ? form.ospite.value : p.ospite;
      const id = nuova ? idPartita(girone, casa, ospite) : p.id;
      const giornata = Number(form.giornata.value);
      const max = totaleGiornate(gironi.find(x => x.id === girone));

      if (casa === ospite) return mostra('Scegli due squadre diverse.');
      if (nuova && a.partite.some(x => x.id === id)) return mostra('Questa partita (stessa squadra in casa) esiste già.');
      if (!Number.isInteger(giornata) || giornata < 1 || giornata > max) return mostra(`La giornata deve essere tra 1 e ${max}.`);

      let gol = null;
      if (st === 'giocata') {
        const gc = leggiGol(form.golCasa.value);
        const go = leggiGol(form.golOspite.value);
        if (gc == null || go == null) return mostra('Inserisci i gol di entrambe le squadre.');
        if (Number.isNaN(gc) || Number.isNaN(go)) return mostra('I gol devono essere numeri interi da 0 in su.');
        gol = { casa: gc, ospite: go };
      } else if (st === 'tavolino') {
        gol = form.vincitore.value === 'casa' ? { casa: 3, ospite: 0 } : { casa: 0, ospite: 3 };
      }
      const rinuncia = st === 'tavolino' && form.rinuncia.checked;

      await stato.modifica(arch => {
        let x = arch.partite.find(y => y.id === id);
        if (!x) {
          x = { id, competizione: 'campionato', girone, casa, ospite, recupero: false };
          arch.partite.push(x);
        }
        const risultatoCambiato = !nuova && (x.stato !== st || JSON.stringify(x.gol) !== JSON.stringify(gol));
        // Una giornata cambiata a mano non viene riportata al valore del comunicato nelle importazioni successive.
        if (!nuova && x.giornata !== giornata) x.giornataCorretta = true;
        Object.assign(x, {
          giornata,
          data: form.data.value || null,
          ora: form.ora.value || null,
          campo: form.campo.value.trim() || null,
          stato: st,
          gol,
          ufficiale: (st === 'giocata' || st === 'tavolino') && form.ufficiale.checked,
        });
        if (nuova || risultatoCambiato) x.fonte = 'manuale';
        const campo = x.campo;
        if (campo && !arch.campi.includes(campo)) arch.campi.push(campo);

        arch.penalita = arch.penalita.filter(y => y.partita !== id);
        if (rinuncia) {
          const perdente = gol.casa > gol.ospite ? ospite : casa;
          arch.penalita.push({
            id: uid('pen'), squadra: perdente, girone, punti: 1, partita: id,
            motivo: `Rinuncia: ${nomeSquadra(arch, casa)} – ${nomeSquadra(arch, ospite)}`,
          });
        }
      });
      chiudi();
      avvisa(nuova ? 'Partita aggiunta' : 'Partita salvata');
    });
  });
}
