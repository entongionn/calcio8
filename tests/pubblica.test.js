import { test, uguale, vero } from './harness.js';
import { decidiSincronizzazione, pubblica, scaricaPubblicati, verificaToken } from '../app/js/pubblica.js';
import { archivioDaSeed } from '../app/js/archivio.js';
import { STAGIONE_2026_27 } from '../app/js/seed.js';

const versione = (aggiornato, extra = {}) => ({ ...archivioDaSeed(STAGIONE_2026_27), aggiornato, ...extra });
const T1 = '2026-11-03T10:00:00.000Z';
const T2 = '2026-11-03T11:00:00.000Z';
const T3 = '2026-11-03T12:00:00.000Z';
const azione = (...args) => decidiSincronizzazione(...args).azione;

test('chi consulta: prende i dati pubblicati quando sono più recenti', () => {
  uguale(azione(null, versione(T1), null, false), 'usa-remoto');
  uguale(azione(versione(T1), versione(T2), T1, false), 'usa-remoto');
  uguale(azione(versione(T2), versione(T2), T2, false), 'niente');
  uguale(azione(versione(T1), null, T1, false), 'niente', 'offline o non pubblicato: si tiene la copia');
});

test('amministratore: pubblica le proprie modifiche', () => {
  uguale(azione(versione(T2), versione(T1), T1, true), 'pubblica');
  uguale(azione(versione(T1), null, null, true), 'pubblica', 'prima pubblicazione');
});

test('amministratore: la versione vecchia ancora in cache non annulla una pubblicazione', () => {
  // Appena pubblicata T2, GitHub Pages serve ancora T1 per un minuto.
  uguale(azione(versione(T2), versione(T1), T2, true), 'niente');
  uguale(azione(versione(T2), versione(T1), T2, false), 'niente');
});

test('amministratore: modifiche da un altro dispositivo vengono adottate o unite', () => {
  uguale(azione(versione(T1), versione(T2), T1, true), 'usa-remoto', 'nessuna modifica qui');
  const locale = versione(T3, { penalita: [{ id: 'p1', squadra: 'lornano', girone: 'B', punti: 1, motivo: 'qui' }] });
  const remoto = versione(T2, { penalita: [{ id: 'p2', squadra: 'monteroni', girone: 'B', punti: 1, motivo: 'altrove' }] });
  const d = decidiSincronizzazione(locale, remoto, T1, true);
  uguale(d.azione, 'unisci');
  uguale(d.archivio.penalita.map(p => p.id).sort(), ['p1', 'p2']);
});

// --- Chiamate a GitHub, con risposte simulate ---

function finto(risposte) {
  const chiamate = [];
  const fn = async (url, opzioni = {}) => {
    chiamate.push({ url, metodo: opzioni.method ?? 'GET', corpo: opzioni.body ? JSON.parse(opzioni.body) : null, intestazioni: opzioni.headers });
    const [status, corpo] = risposte.shift();
    return { ok: status >= 200 && status < 300, status, json: async () => corpo };
  };
  fn.chiamate = chiamate;
  return fn;
}

test('pubblica: legge lo sha attuale e scrive il file in base64 UTF-8', async () => {
  const f = finto([[200, { sha: 'abc' }], [200, { commit: { sha: 'def' } }]]);
  const a = versione(T1, { stagione: { id: '2026-27', nome: 'Città – Niccolò' } });
  uguale(await pubblica(a, 'TOKEN', f), 'def');
  const put = f.chiamate[1];
  uguale([put.metodo, put.corpo.sha, put.corpo.branch], ['PUT', 'abc', 'main']);
  vero(put.url.endsWith('/repos/entongionn/calcio8/contents/app/dati.json'));
  vero(put.intestazioni.Authorization === 'Bearer TOKEN');
  const decodificato = new TextDecoder().decode(Uint8Array.from(atob(put.corpo.content), c => c.charCodeAt(0)));
  uguale(JSON.parse(decodificato).stagione.nome, 'Città – Niccolò');
});

test('pubblica: primo invio senza file esistente e nuovo tentativo su conflitto', async () => {
  const f = finto([[404, {}], [409, {}], [200, { sha: 'nuovo' }], [201, { commit: { sha: 'ok' } }]]);
  uguale(await pubblica(versione(T1), 'T', f), 'ok');
  uguale(f.chiamate[1].corpo.sha, undefined);
  uguale(f.chiamate[3].corpo.sha, 'nuovo');
});

test('pubblica: token scaduto → errore chiaro', async () => {
  let messaggio = '';
  try { await pubblica(versione(T1), 'T', finto([[401, {}]])); } catch (e) { messaggio = e.message; }
  uguale(messaggio, 'token non valido o scaduto');
});

test('verificaToken: permessi e repository', async () => {
  uguale(await verificaToken('T', finto([[200, { permissions: { push: true } }]])), null);
  vero((await verificaToken('T', finto([[200, { permissions: { push: false } }]]))).includes('Read and write'));
  vero((await verificaToken('T', finto([[404, {}]]))).includes('entongionn/calcio8'));
  vero((await verificaToken('T', finto([[401, {}]]))).includes('scaduto'));
});

test('scaricaPubblicati: dati validi, file assente, dati non validi', async () => {
  uguale((await scaricaPubblicati(finto([[200, versione(T1)]])))?.aggiornato, T1);
  uguale(await scaricaPubblicati(finto([[404, {}]])), null);
  uguale(await scaricaPubblicati(finto([[200, { a: 1 }]])), null);
  uguale(await scaricaPubblicati(async () => { throw new Error('offline'); }), null);
});
