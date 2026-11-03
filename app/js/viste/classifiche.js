import * as stato from '../stato.js';
import { calcolaClassifica, partitaConta } from '../classifica.js';
import { classificaMarcatori } from '../marcatori.js';
import { nomiSquadre } from '../archivio.js';
import { avvisa, esc } from '../util.js';
import { apriDialogo, gironiCampionato, nomeSquadra, stemmaSquadra, testata, vistaBenvenuto } from './comuni.js';
import { rigaMarcatore } from './marcatori.js';

// Regolamento, Par.2: le prime 3 di ogni girone formano il girone di Eccellenza.
const POSTI_ECCELLENZA = 3;

let colonneComplete = false;

export function vistaClassifiche(el, [gironeId]) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  const gironi = gironiCampionato(a);
  const girone = gironi.find(g => g.id === gironeId) ?? gironi[0];
  const partite = a.partite.filter(p => p.girone === girone.id);
  const c = calcolaClassifica({
    squadre: girone.squadre,
    partite,
    penalita: a.penalita.filter(p => p.girone === girone.id),
    sorteggio: a.sorteggi?.[girone.id] ?? [],
    nomi: nomiSquadre(a),
  });
  const contate = partite.filter(partitaConta);
  const ultimaGiornata = Math.max(0, ...contate.map(p => p.giornata));
  const provvisorie = contate.filter(p => !p.ufficiale).length;
  const nome = id => esc(nomeSquadra(a, id));
  const marcatori = classificaMarcatori(a, girone.squadre).slice(0, 3);

  el.innerHTML = `
    ${testata('Classifica')}
    <nav class="segmenti" aria-label="Gironi">
      ${gironi.map(g => `<a href="#/classifiche/${g.id}" ${g.id === girone.id ? 'aria-current="page"' : ''}>${esc(g.nome)}</a>`).join('')}
    </nav>
    <p class="sottotitolo">
      ${ultimaGiornata ? `Dopo la ${ultimaGiornata}ª giornata` : 'Nessuna partita giocata'}
      ${provvisorie ? `· <span class="etichetta provvisorio">${provvisorie} risultat${provvisorie === 1 ? 'o' : 'i'} provvisori${provvisorie === 1 ? 'o' : ''}</span>` : ''}
    </p>
    <div class="tabella-contenitore">
      <table class="classifica${colonneComplete ? ' completa' : ''}">
        <thead>
          <tr>
            <th class="pos" scope="col">#</th>
            <th class="sq" scope="col">Squadra</th>
            <th scope="col" title="Gare giocate">G</th>
            <th scope="col" title="Vinte">V</th>
            <th scope="col" title="Pareggiate">N</th>
            <th scope="col" title="Perse">P</th>
            <th class="det" scope="col" title="Reti fatte">RF</th>
            <th class="det" scope="col" title="Reti subite">RS</th>
            <th class="det" scope="col" title="Differenza reti">DR</th>
            <th class="pt" scope="col" title="Punti">Pt</th>
          </tr>
        </thead>
        <tbody>
          ${c.righe.map(r => `
            <tr>
              <td class="pos"><span class="numero-pos${ultimaGiornata && r.pos <= POSTI_ECCELLENZA ? ' qualificata' : ''}">${r.pos}</span></td>
              <th class="sq" scope="row">
                <a class="riga-squadra" href="#/squadra/${esc(r.squadra)}">${stemmaSquadra(a, r.squadra, 22)}<span>${nome(r.squadra)}</span></a>
              </th>
              <td>${r.giocate}</td>
              <td>${r.v}</td>
              <td>${r.n}</td>
              <td>${r.p}</td>
              <td class="det">${r.rf}</td>
              <td class="det">${r.rs}</td>
              <td class="det">${r.dr > 0 ? '+' : ''}${r.dr}</td>
              <td class="pt">${r.punti}${r.penalita ? '<sup>*</sup>' : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${ultimaGiornata ? `<p class="legenda"><span class="numero-pos qualificata"></span> Le prime ${POSTI_ECCELLENZA} vanno nel girone Eccellenza</p>` : ''}
    <button class="collegamento" id="colonne">${colonneComplete ? 'Mostra meno colonne' : 'Reti fatte, subite e differenza'}</button>

    ${c.righe.some(r => r.penalita) ? `
      <p class="nota">* Penalizzazioni: ${c.righe.filter(r => r.penalita).map(r => `${nome(r.squadra)} −${r.penalita}`).join(', ')}.</p>` : ''}

    ${c.irrisolte.map(gruppo => `
      <div class="riquadro attenzione">
        <p><strong>Parità non risolta</strong> tra ${gruppo.map(nome).join(', ')}.
        Servono la classifica Fair-Play o il sorteggio. Per ora l'ordine è alfabetico.</p>
        ${stato.isAmministratore() ? `<button class="secondario" data-sorteggio="${esc(gruppo.join(','))}">Imposta l'ordine del sorteggio</button>` : ''}
      </div>`).join('')}

    ${marcatori.length ? `
      <section class="scheda" style="margin-top:16px">
        <div class="scheda-titolo"><h2>Classifica marcatori</h2><a href="#/marcatori/${girone.id}">Vedi tutti →</a></div>
        <ol class="elenco-marcatori">${marcatori.map(r => rigaMarcatore(a, r)).join('')}</ol>
      </section>` : ''}

    ${c.spareggi.length ? `
      <details class="spareggi">
        <summary>Come sono state risolte le parità</summary>
        <ul>
          ${c.spareggi.map(s => `<li>${s.squadre.map(nome).join(', ')}: <strong>${esc(s.etichetta)}</strong></li>`).join('')}
        </ul>
      </details>` : ''}`;

  el.querySelector('#colonne').addEventListener('click', () => {
    colonneComplete = !colonneComplete;
    vistaClassifiche(el, [girone.id]);
  });
  el.querySelectorAll('[data-sorteggio]').forEach(b => b.addEventListener('click', () => {
    dialogoSorteggio(girone, b.dataset.sorteggio.split(','));
  }));
}

function dialogoSorteggio(girone, gruppo) {
  const a = stato.corrente();
  const ordine = [...gruppo];
  const lista = () => ordine.map((id, i) => `
    <li>
      <span>${i + 1}. ${esc(nomeSquadra(a, id))}</span>
      <span class="sposta">
        <button type="button" data-su="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">▲</button>
        <button type="button" data-giu="${i}" ${i === ordine.length - 1 ? 'disabled' : ''} aria-label="Sposta giù">▼</button>
      </span>
    </li>`).join('');

  apriDialogo(`
    <form method="dialog">
      <h2>Ordine del sorteggio</h2>
      <p>Indica l'ordine stabilito dal sorteggio del comitato. Vale solo se tutti gli altri criteri finiscono in parità.</p>
      <ol class="ordinabile">${lista()}</ol>
      <div class="azioni">
        <button type="button" class="secondario" data-annulla>Annulla</button>
        <button type="button" class="primario" data-salva>Salva</button>
      </div>
    </form>`, (dialog, chiudi) => {
    const ol = dialog.querySelector('ol');
    ol.addEventListener('click', e => {
      const su = e.target.closest('[data-su]');
      const giu = e.target.closest('[data-giu]');
      const i = Number((su ?? giu)?.dataset.su ?? (su ?? giu)?.dataset.giu);
      if (Number.isNaN(i)) return;
      const j = su ? i - 1 : i + 1;
      [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
      ol.innerHTML = lista();
    });
    dialog.querySelector('[data-annulla]').addEventListener('click', chiudi);
    dialog.querySelector('[data-salva]').addEventListener('click', async () => {
      await stato.modifica(arch => {
        arch.sorteggi ??= {};
        const resto = (arch.sorteggi[girone.id] ?? []).filter(id => !ordine.includes(id));
        arch.sorteggi[girone.id] = [...resto, ...ordine];
      });
      chiudi();
      avvisa('Ordine del sorteggio salvato');
    });
  });
}
