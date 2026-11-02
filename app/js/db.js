// Salvataggio sul dispositivo con IndexedDB.
//   archivio      → l'archivio corrente, sotto la chiave 'corrente' (scrittura atomica)
//   snapshot      → copie automatiche dell'archivio, create prima delle operazioni rischiose
//   impostazioni  → valori sparsi (data dell'ultimo backup, ecc.)

const NOME_DB = 'aics-calcio8';
const VERSIONE_DB = 1;
export const MAX_SNAPSHOT = 30;

let apertura = null;

function apri() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB non disponibile'));
  apertura ??= new Promise((ok, ko) => {
    const req = indexedDB.open(NOME_DB, VERSIONE_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('archivio')) db.createObjectStore('archivio');
      if (!db.objectStoreNames.contains('snapshot')) db.createObjectStore('snapshot', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('impostazioni')) db.createObjectStore('impostazioni');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
    req.onblocked = () => ko(new Error('Database bloccato da un\'altra scheda aperta'));
  }).catch(e => {
    apertura = null;
    throw e;
  });
  return apertura;
}

// Esegue `operazioni` in una transazione e restituisce il risultato dell'ultima richiesta
// che esse restituiscono, solo dopo che la transazione è stata completata.
async function transazione(store, modo, operazioni) {
  const db = await apri();
  return new Promise((ok, ko) => {
    const tx = db.transaction(store, modo);
    let risultato;
    const req = operazioni(tx.objectStore(store));
    if (req) req.onsuccess = () => { risultato = req.result; };
    tx.oncomplete = () => ok(risultato);
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error ?? new Error('Transazione annullata'));
  });
}

export async function disponibile() {
  try {
    await apri();
    return true;
  } catch {
    return false;
  }
}

export const leggiArchivio = () => transazione('archivio', 'readonly', s => s.get('corrente'));
export const scriviArchivio = archivio => transazione('archivio', 'readwrite', s => s.put(archivio, 'corrente'));
export const cancellaArchivio = () => transazione('archivio', 'readwrite', s => s.delete('corrente'));

export function aggiungiSnapshot(archivio, motivo) {
  return transazione('snapshot', 'readwrite', s => {
    s.add({ creato: new Date().toISOString(), motivo, archivio });
    const chiavi = s.getAllKeys();
    chiavi.onsuccess = () => {
      const eccesso = chiavi.result.length - MAX_SNAPSHOT;
      for (let i = 0; i < eccesso; i++) s.delete(chiavi.result[i]);
    };
  });
}

export async function elencoSnapshot() {
  const tutti = await transazione('snapshot', 'readonly', s => s.getAll());
  return (tutti ?? []).sort((a, b) => b.id - a.id);
}

export const leggiSnapshot = id => transazione('snapshot', 'readonly', s => s.get(id));

export const leggiImpostazione = chiave => transazione('impostazioni', 'readonly', s => s.get(chiave));
export const scriviImpostazione = (chiave, valore) => transazione('impostazioni', 'readwrite', s => s.put(valore, chiave));
