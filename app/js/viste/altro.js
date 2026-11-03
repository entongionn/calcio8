import * as stato from '../stato.js';
import { REPOSITORY } from '../pubblica.js';
import { avvisa, esc, formattaDataOra } from '../util.js';
import { ICONE, apriDialogo, testata } from './comuni.js';

const voce = (href, icona, testo) => `<li><a href="${href}">${icona}<span>${testo}</span><span class="freccia">›</span></a></li>`;

export function vistaAltro(el) {
  const admin = stato.isAmministratore();
  const pub = stato.statoPubblicazione();

  el.innerHTML = `
    ${testata('Altro')}
    <ul class="menu">
      ${voce('#/marcatori', ICONE.marcatori, 'Classifica marcatori')}
      ${voce('#/novita', ICONE.novita, 'Novità')}
      ${voce('#/installa', ICONE.telefono, 'Installa l\'app sul telefono')}
    </ul>

    <h2 class="data">Amministrazione</h2>
    ${admin ? `
      <section class="scheda">
        <p><strong>Questo telefono è l'amministratore.</strong> Ogni modifica viene pubblicata da sola ed è visibile a tutti.</p>
        <p class="nota">Pubblicazione: ${pub.stato === 'errore' ? `non riuscita (${esc(pub.errore)})` : pub.stato === 'ok' ? (pub.quando ? `ultima alle ${esc(formattaDataOra(pub.quando))}` : 'tutto aggiornato') : 'in corso…'}</p>
        <div class="azioni">
          <a class="bottone primario" href="#/facebook">Importa post Facebook</a>
          <a class="bottone secondario" href="#/gestione">Gestione</a>
          ${pub.stato === 'errore' ? '<button class="secondario" id="riprova">Riprova a pubblicare</button>' : ''}
        </div>
        <button class="collegamento pericolo" id="esci">Togli l'accesso da questo telefono</button>
      </section>` : `
      <ul class="menu">
        <li><button id="accedi">${ICONE.chiave}<span>Accesso amministratore</span><span class="freccia">›</span></button></li>
      </ul>
      <p class="nota">Solo chi aggiorna i risultati ne ha bisogno. Tutti gli altri vedono i dati senza fare nulla.</p>`}`;

  el.querySelector('#accedi')?.addEventListener('click', dialogoToken);
  el.querySelector('#riprova')?.addEventListener('click', async () => {
    if (await stato.pubblicaOra()) avvisa('Dati pubblicati');
    else avvisa(`Pubblicazione non riuscita: ${stato.statoPubblicazione().errore}`, 'errore');
    vistaAltro(el);
  });
  el.querySelector('#esci')?.addEventListener('click', async () => {
    if (!confirm('Togliere l\'accesso amministratore da questo telefono? I dati restano visibili, ma non potrai più modificarli da qui.')) return;
    await stato.rimuoviToken();
    avvisa('Accesso rimosso');
  });
}

function dialogoToken() {
  const repo = `${REPOSITORY.proprietario}/${REPOSITORY.nome}`;
  apriDialogo(`
    <form method="dialog">
      <h2>Accesso amministratore</h2>
      <p>Serve un <strong>token GitHub</strong> che può scrivere solo nella repository <strong>${esc(repo)}</strong>. Resta salvato solo su questo telefono.</p>
      <ol class="nota">
        <li>Su github.com apri <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong> e premi <strong>Generate new token</strong>.</li>
        <li>Nome: <em>calcio8 app</em>. Scadenza: la più lunga possibile.</li>
        <li>Repository access: <strong>Only select repositories</strong> → <em>${esc(REPOSITORY.nome)}</em>.</li>
        <li>Permissions → Repository permissions → <strong>Contents: Read and write</strong>.</li>
        <li>Premi <strong>Generate token</strong>, copialo e incollalo qui.</li>
      </ol>
      <label>Token <input name="token" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
      <p class="errore" role="alert" hidden></p>
      <div class="azioni">
        <button type="button" class="secondario" data-annulla>Annulla</button>
        <button type="submit" class="primario">Verifica e salva</button>
      </div>
    </form>`, (dialog, chiudi) => {
    const form = dialog.querySelector('form');
    const errore = dialog.querySelector('.errore');
    dialog.querySelector('[data-annulla]').addEventListener('click', chiudi);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const invio = form.querySelector('[type="submit"]');
      invio.disabled = true;
      invio.textContent = 'Verifica…';
      const messaggio = await stato.impostaToken(form.token.value);
      if (messaggio) {
        errore.textContent = messaggio;
        errore.hidden = false;
        invio.disabled = false;
        invio.textContent = 'Verifica e salva';
        return;
      }
      chiudi();
      avvisa('Accesso attivato: le modifiche saranno pubblicate per tutti');
    });
  });
}

export function vistaInstalla(el) {
  el.innerHTML = `
    ${testata('Installa l\'app', '#/altro')}
    <section class="scheda">
      <h2>iPhone</h2>
      <ol>
        <li>Apri questa pagina con <strong>Safari</strong>.</li>
        <li>Tocca <strong>Condividi</strong> (il quadrato con la freccia in su).</li>
        <li>Scegli <strong>Aggiungi alla schermata Home</strong>, poi <strong>Aggiungi</strong>.</li>
      </ol>
    </section>
    <section class="scheda">
      <h2>Android</h2>
      <ol>
        <li>Apri questa pagina con <strong>Chrome</strong>.</li>
        <li>Tocca il menu <strong>⋮</strong> in alto a destra.</li>
        <li>Scegli <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).</li>
      </ol>
    </section>
    <p class="nota">L'app si aggiorna da sola e funziona anche senza connessione, con gli ultimi dati scaricati.</p>`;
}
