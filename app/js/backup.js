// Esportazione dell'archivio come file JSON e promemoria del backup.

import * as db from './db.js';
import * as stato from './stato.js';
import { condividiFile, scaricaFile } from './util.js';

const GIORNI_PROMEMORIA = 7;

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

/** Vero se ci sono modifiche non comprese nell'ultimo backup e il backup è vecchio (o mai fatto). */
export async function serveBackup() {
  const archivio = stato.corrente();
  if (!archivio?.aggiornato) return false;
  const ultimo = await ultimoBackup();
  if (ultimo && ultimo >= archivio.aggiornato) return false;
  if (!ultimo) return archivio.partite.some(p => p.gol) || archivio.penalita.length > 0;
  return Date.now() - new Date(ultimo).getTime() > GIORNI_PROMEMORIA * 86400000;
}
