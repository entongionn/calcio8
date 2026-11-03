// Esportazione dell'archivio come file JSON.

import * as db from './db.js';
import * as stato from './stato.js';
import { condividiFile, scaricaFile } from './util.js';

function nomeFile() {
  const d = new Date();
  const due = n => String(n).padStart(2, '0');
  return `aics-backup-${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}-${due(d.getHours())}${due(d.getMinutes())}.json`;
}

/** Esporta l'archivio. `modo`: 'scarica' o 'condividi'. Restituisce false se l'utente annulla. */
export async function esporta(modo = 'scarica') {
  const archivio = stato.corrente();
  if (!archivio) return false;
  const testo = JSON.stringify(archivio, null, 1);
  const nome = nomeFile();
  if (modo === 'condividi') {
    if (!(await condividiFile(nome, testo))) return false;
  } else {
    scaricaFile(nome, testo);
  }
  try {
    await db.scriviImpostazione('ultimoBackup', new Date().toISOString());
  } catch {
    // Senza IndexedDB non si può ricordare la data del backup: non è un errore dell'esportazione.
  }
  return true;
}

export async function ultimoBackup() {
  try {
    return (await db.leggiImpostazione('ultimoBackup')) ?? null;
  } catch {
    return null;
  }
}
