// Dati condivisi: l'archivio pubblicato è il file app/dati.json della repository GitHub,
// servito da GitHub Pages insieme all'app. Chi consulta lo scarica; l'amministratore,
// con un token GitHub salvato solo sul proprio telefono, lo aggiorna con l'API ufficiale.

import { migraArchivio, unisciArchivi, verificaArchivio } from './archivio.js';

export const REPOSITORY = { proprietario: 'entongionn', nome: 'calcio8', branch: 'main', percorso: 'app/dati.json' };
const API = `https://api.github.com/repos/${REPOSITORY.proprietario}/${REPOSITORY.nome}`;

/** Scarica i dati pubblicati. Restituisce null se non sono ancora stati pubblicati o se si è offline. */
export async function scaricaPubblicati(fetchFn = fetch) {
  try {
    // Il parametro evita la cache del CDN di GitHub Pages (10 minuti).
    const risposta = await fetchFn(`./dati.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!risposta.ok) return null;
    const dati = migraArchivio(await risposta.json());
    return verificaArchivio(dati).length ? null : dati;
  } catch {
    return null;
  }
}

/**
 * Decide come allineare il telefono ai dati pubblicati.
 * @param {object|null} locale        archivio sul telefono
 * @param {object|null} remoto        archivio pubblicato
 * @param {string|null} basePubblicata data (`aggiornato`) dell'ultima versione pubblicata o scaricata su questo telefono
 * @param {boolean} amministratore    il telefono può pubblicare
 * @returns {{ azione: 'niente'|'usa-remoto'|'pubblica'|'unisci', archivio?: object }}
 */
export function decidiSincronizzazione(locale, remoto, basePubblicata, amministratore) {
  if (!remoto) return amministratore && locale ? { azione: 'pubblica' } : { azione: 'niente' };
  if (!locale) return { azione: 'usa-remoto', archivio: remoto };
  if (remoto.aggiornato === locale.aggiornato) return { azione: 'niente' };

  const modificheLocali = locale.aggiornato !== basePubblicata;
  // Solo una versione più recente conta: subito dopo una pubblicazione GitHub Pages può servire
  // ancora per un minuto quella precedente, che non deve sostituire i dati appena pubblicati.
  const remotoCambiato = !basePubblicata || remoto.aggiornato > basePubblicata;
  // Chi consulta non modifica nulla: prende sempre la versione pubblicata.
  if (!amministratore || !modificheLocali) return remotoCambiato ? { azione: 'usa-remoto', archivio: remoto } : { azione: 'niente' };
  if (!remotoCambiato) return { azione: 'pubblica' };
  // Modificati sia qui sia altrove: si uniscono, e per le differenze vale questo telefono.
  return { azione: 'unisci', archivio: unisciArchivi(remoto, locale, 'altro') };
}

function base64(testo) {
  const byte = new TextEncoder().encode(testo);
  let binario = '';
  for (let i = 0; i < byte.length; i += 0x8000) binario += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(binario);
}

function intestazioni(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}

/** Controlla che il token possa scrivere nella repository. Restituisce un messaggio d'errore o null. */
export async function verificaToken(token, fetchFn = fetch) {
  try {
    const r = await fetchFn(API, { headers: intestazioni(token) });
    if (r.status === 401) return 'Token non valido o scaduto.';
    if (r.status === 404) return `Il token non ha accesso alla repository ${REPOSITORY.proprietario}/${REPOSITORY.nome}.`;
    if (!r.ok) return `GitHub ha risposto con un errore (${r.status}).`;
    const repo = await r.json();
    if (repo.permissions && !repo.permissions.push) return 'Il token può leggere ma non scrivere: serve il permesso «Contents: Read and write».';
    return null;
  } catch {
    return 'Impossibile contattare GitHub: controlla la connessione.';
  }
}

/** Scrive l'archivio in app/dati.json con un commit. Ritenta una volta se il file è cambiato nel frattempo. */
export async function pubblica(archivio, token, fetchFn = fetch) {
  const url = `${API}/contents/${REPOSITORY.percorso}`;
  const contenuto = base64(`${JSON.stringify(archivio, null, 1)}\n`);
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    const attuale = await fetchFn(`${url}?ref=${REPOSITORY.branch}&t=${Date.now()}`, { headers: intestazioni(token), cache: 'no-store' });
    if (attuale.status === 401) throw new Error('token non valido o scaduto');
    const sha = attuale.ok ? (await attuale.json()).sha : undefined;
    const r = await fetchFn(url, {
      method: 'PUT',
      headers: { ...intestazioni(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Aggiornamento dati ${new Date(archivio.aggiornato ?? Date.now()).toLocaleString('it-IT')}`,
        content: contenuto,
        branch: REPOSITORY.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (r.ok) return (await r.json()).commit?.sha ?? null;
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ha risposto con un errore (${r.status})`);
  }
  throw new Error('il file è stato modificato nello stesso momento da un altro dispositivo');
}
