import * as db from '../db.js';
import * as stato from '../stato.js';
import * as backup from '../backup.js';
import { confrontaArchivi, unisciArchivi, verificaArchivio } from '../archivio.js';
import { avvisa, esc, formattaDataOra, puoCondividereFile, uid } from '../util.js';
import { gironiCampionato, nomeSquadra, opzioniSquadre } from './comuni.js';

// Backup letto da file e in attesa di conferma.
let daImportare = null;

const NOMI_COLLEZIONI = { squadre: 'Squadre', competizioni: 'Competizioni', gironi: 'Gironi', partite: 'Partite', penalita: 'Penalizzazioni' };

export async function vistaGestione(el) {
  const a = stato.corrente();
  const [ultimo, persistente, copie] = await Promise.all([
    backup.ultimoBackup(),
    stato.persistente().catch(() => null),
    stato.isVolatile() ? [] : db.elencoSnapshot().catch(() => []),
  ]);
  const giocate = a ? a.partite.filter(p => p.gol).length : 0;

  el.innerHTML = `
    <h1>Gestione</h1>

    <section class="scheda">
      <h2>Dati su questo dispositivo</h2>
      ${a ? `
        <dl class="riepilogo">
          <dt>Stagione</dt><dd>${esc(a.stagione?.nome ?? '—')}</dd>
          <dt>Partite</dt><dd>${a.partite.length} in calendario, ${giocate} con risultato</dd>
          <dt>Ultima modifica</dt><dd>${esc(formattaDataOra(a.aggiornato))}</dd>
          <dt>Ultimo backup</dt><dd>${esc(formattaDataOra(ultimo))}</dd>
          <dt>Archivio protetto</dt><dd>${persistente === true ? 'sì' : persistente === false ? 'no: il sistema potrebbe cancellarlo se lo spazio scarseggia' : 'non verificabile'}</dd>
        </dl>` : '<p>Nessun dato salvato.</p>'}
      <p class="nota">I dati sono salvati solo in questo browser. Non si sincronizzano con altri dispositivi:
      per spostarli usa il backup. Su iPhone, se elimini l'icona dalla schermata Home, i dati vengono cancellati.</p>
    </section>

    <section class="scheda">
      <h2>Backup</h2>
      <p>Il backup è un file con tutti i dati. Conservalo fuori dal telefono (PC, cloud, e-mail).</p>
      <div class="azioni">
        ${a ? '<button class="primario" id="scarica">Scarica backup</button>' : ''}
        ${a && puoCondividereFile() ? '<button class="secondario" id="condividi">Condividi backup</button>' : ''}
        <label class="bottone secondario">Importa backup<input type="file" id="file-backup" accept=".json,application/json" hidden></label>
      </div>
      <div id="anteprima-backup"></div>
    </section>

    ${a ? `
    <section class="scheda">
      <h2>Calendario e squadre</h2>
      <div class="azioni">
        <a class="bottone secondario" href="#/calendario">Importa calendario</a>
        <a class="bottone secondario" href="#/squadre">Squadre e nomi alternativi</a>
      </div>
    </section>

    <section class="scheda">
      <h2>Penalizzazioni</h2>
      ${a.penalita.length ? `
        <ul class="elenco">
          ${a.penalita.map(p => `
            <li>
              <span><strong>${esc(nomeSquadra(a, p.squadra))}</strong> −${p.punti} · ${esc(p.motivo)}</span>
              ${p.partita ? '<span class="nota">dalla partita</span>' : `<button class="collegamento pericolo" data-elimina-pen="${esc(p.id)}">Elimina</button>`}
            </li>`).join('')}
        </ul>` : '<p class="nota">Nessuna penalizzazione.</p>'}
      <form id="nuova-penalita" class="in-linea">
        <label>Squadra <select name="squadra">${gironiCampionato(a).map(g => `<optgroup label="${esc(g.nome)}">${opzioniSquadre(a, g.squadre)}</optgroup>`).join('')}</select></label>
        <label>Punti <input name="punti" type="number" inputmode="numeric" min="1" max="99" value="1"></label>
        <label class="largo">Motivo <input name="motivo" required placeholder="Es. acconto non versato"></label>
        <button class="secondario" type="submit">Aggiungi</button>
      </form>
      <p class="nota">Le penalizzazioni per rinuncia si aggiungono dalla partita, scegliendo «Vinta a tavolino».</p>
    </section>` : ''}

    ${copie.length ? `
    <section class="scheda">
      <h2>Copie automatiche</h2>
      <p class="nota">L'app salva una copia prima di ogni operazione rischiosa e una volta al giorno (ultime 30).</p>
      <ul class="elenco">
        ${copie.map(c => `
          <li>
            <span>${esc(formattaDataOra(c.creato))} · ${esc(c.motivo)}<br>
            <span class="nota">${c.archivio.partite.length} partite, ${c.archivio.partite.filter(p => p.gol).length} con risultato</span></span>
            <button class="collegamento" data-ripristina="${c.id}">Ripristina</button>
          </li>`).join('')}
      </ul>
    </section>` : ''}

    ${a ? `
    <section class="scheda">
      <h2>Cancella tutto</h2>
      <p>Elimina tutti i dati da questo dispositivo. Prima viene salvata una copia automatica.</p>
      <button class="pericolo" id="cancella">Cancella tutti i dati</button>
    </section>` : ''}`;

  el.querySelector('#scarica')?.addEventListener('click', async () => {
    if (await backup.esporta('scarica')) avvisa('Backup scaricato');
    vistaGestione(el);
  });
  el.querySelector('#condividi')?.addEventListener('click', async () => {
    try {
      if (await backup.esporta('condividi')) avvisa('Backup condiviso');
    } catch (e) {
      avvisa(`Condivisione non riuscita: ${e.message}`, 'errore');
    }
    vistaGestione(el);
  });
  el.querySelector('#file-backup').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await leggiBackup(file, el);
  });
  if (daImportare) mostraAnteprima(el);

  el.querySelector('#nuova-penalita')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const punti = Number(f.punti.value);
    if (!Number.isInteger(punti) || punti < 1) return avvisa('I punti devono essere un numero intero positivo', 'errore');
    const squadra = f.squadra.value;
    const girone = gironiCampionato(a).find(g => g.squadre.includes(squadra)).id;
    await stato.modifica(arch => {
      arch.penalita.push({ id: uid('pen'), squadra, girone, punti, motivo: f.motivo.value.trim(), data: new Date().toISOString().slice(0, 10) });
    });
    avvisa('Penalizzazione aggiunta');
  });
  el.querySelectorAll('[data-elimina-pen]').forEach(b => b.addEventListener('click', async () => {
    const pen = a.penalita.find(p => p.id === b.dataset.eliminaPen);
    if (!confirm(`Eliminare la penalizzazione di ${nomeSquadra(a, pen.squadra)}?`)) return;
    await stato.modifica(arch => { arch.penalita = arch.penalita.filter(p => p.id !== pen.id); });
    avvisa('Penalizzazione eliminata');
  }));

  el.querySelectorAll('[data-ripristina]').forEach(b => b.addEventListener('click', async () => {
    const copia = copie.find(c => c.id === Number(b.dataset.ripristina));
    if (!confirm(`Ripristinare la copia del ${formattaDataOra(copia.creato)}? I dati attuali verranno salvati in una nuova copia.`)) return;
    await stato.salva(structuredClone(copia.archivio), { copiaPrima: 'Prima del ripristino di una copia automatica' });
    avvisa('Copia ripristinata');
  }));

  el.querySelector('#cancella')?.addEventListener('click', async () => {
    if (!confirm('Cancellare tutti i dati da questo dispositivo?')) return;
    if (!confirm('Confermi? Potrai recuperarli solo da un backup o dalle copie automatiche.')) return;
    await stato.cancellaTutto();
    avvisa('Dati cancellati');
  });
}

async function leggiBackup(file, el) {
  let dati;
  try {
    dati = JSON.parse(await file.text());
  } catch {
    avvisa('Il file non è un JSON valido', 'errore');
    return;
  }
  const errori = verificaArchivio(dati);
  if (errori.length) {
    daImportare = null;
    el.querySelector('#anteprima-backup').innerHTML = `
      <div class="riquadro errore"><p><strong>Backup non importabile</strong></p>
      <ul>${errori.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    return;
  }
  daImportare = { nome: file.name, dati };
  mostraAnteprima(el);
}

function mostraAnteprima(el) {
  const a = stato.corrente();
  const { nome, dati } = daImportare;
  const contenitore = el.querySelector('#anteprima-backup');
  const conf = a ? confrontaArchivi(a, dati) : null;
  const differenze = conf ? Object.values(conf.collezioni).reduce((n, c) => n + c.diversi.length, 0) + conf.sorteggiDiversi : 0;

  contenitore.innerHTML = `
    <div class="riquadro">
      <p><strong>${esc(nome)}</strong><br>
      ${esc(dati.stagione?.nome ?? '')} · salvato il ${esc(formattaDataOra(dati.aggiornato))}</p>
      ${conf?.stagioneDiversa ? '<p class="errore">Attenzione: il backup è di un\'altra stagione.</p>' : ''}
      ${conf ? `
        <table class="confronto">
          <thead><tr><th></th><th>Nuovi</th><th>Uguali</th><th>Diversi</th><th>Solo qui</th></tr></thead>
          <tbody>
            ${Object.entries(conf.collezioni).map(([k, c]) => `
              <tr><th scope="row">${NOMI_COLLEZIONI[k]}</th><td>${c.nuovi}</td><td>${c.uguali}</td><td>${c.diversi.length}</td><td>${c.soloMiei}</td></tr>`).join('')}
          </tbody>
        </table>
        <p class="nota">«Uguali» non vengono duplicati. «Solo qui» sono dati presenti solo su questo dispositivo: con l'unione restano, con la sostituzione vengono eliminati.</p>
        ${differenze ? `<p>${differenze === 1 ? 'C\'è <strong>1</strong> record diverso' : `Ci sono <strong>${differenze}</strong> record diversi`}: scegli quale versione tenere.</p>` : ''}
        <div class="azioni verticali">
          ${differenze ? `
            <button class="primario" data-azione="unisci-altro">Unisci, per le differenze tieni il backup</button>
            <button class="secondario" data-azione="unisci-mio">Unisci, per le differenze tieni i miei dati</button>`
          : '<button class="primario" data-azione="unisci-altro">Unisci</button>'}
          <button class="secondario" data-azione="sostituisci">Sostituisci tutto con il backup</button>
          <button class="collegamento" data-azione="annulla">Annulla</button>
        </div>` : `
        <div class="azioni">
          <button class="primario" data-azione="sostituisci">Ripristina questo backup</button>
          <button class="collegamento" data-azione="annulla">Annulla</button>
        </div>`}
    </div>`;

  contenitore.querySelectorAll('[data-azione]').forEach(b => b.addEventListener('click', async () => {
    const azione = b.dataset.azione;
    if (azione === 'annulla') {
      daImportare = null;
      contenitore.innerHTML = '';
      return;
    }
    if (azione === 'sostituisci' && a && !confirm('Sostituire tutti i dati con quelli del backup? I dati attuali verranno salvati in una copia automatica.')) return;
    const nuovo = azione === 'sostituisci' ? structuredClone(dati) : unisciArchivi(a, dati, azione === 'unisci-altro' ? 'altro' : 'mio');
    daImportare = null;
    await stato.salva(nuovo, { copiaPrima: `Prima dell'importazione di ${nome}` });
    avvisa(azione === 'sostituisci' ? 'Backup ripristinato' : 'Backup unito');
  }));
}
