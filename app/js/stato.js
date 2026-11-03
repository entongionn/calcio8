// Stato dell'app: l'archivio in memoria, il suo salvataggio e le copie di sicurezza.
// Ogni modifica passa da `modifica()`, che lavora su una copia e la salva tutta insieme.

import * as db from './db.js';
import { migraArchivio } from './archivio.js';

let archivio = null;
let volatile = false;
const ascoltatori = new Set();

export const corrente = () => archivio;
export const isVolatile = () => volatile;

export function ascolta(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

export async function carica() {
  if (!(await db.disponibile())) {
    volatile = true;
    return null;
  }
  archivio = migraArchivio((await db.leggiArchivio()) ?? null);
  return archivio;
}

function oggi() {
  return new Date().toISOString().slice(0, 10);
}

async function snapshotGiornaliero() {
  if (!archivio) return;
  const ultimo = await db.leggiImpostazione('ultimaCopiaAutomatica');
  if (ultimo === oggi()) return;
  await db.aggiungiSnapshot(archivio, 'Copia automatica giornaliera');
  await db.scriviImpostazione('ultimaCopiaAutomatica', oggi());
}

async function chiediPersistenza() {
  if (!navigator.storage?.persist) return;
  if (await db.leggiImpostazione('persistenzaChiesta')) return;
  await navigator.storage.persist();
  await db.scriviImpostazione('persistenzaChiesta', true);
}

/**
 * Sostituisce l'archivio. Con `copiaPrima` salva prima una copia di sicurezza dell'archivio
 * attuale con quella descrizione; altrimenti ne crea al più una al giorno.
 */
export async function salva(nuovo, { copiaPrima = null } = {}) {
  nuovo.aggiornato = new Date().toISOString();
  if (!volatile) {
    if (copiaPrima && archivio) await db.aggiungiSnapshot(archivio, copiaPrima);
    else await snapshotGiornaliero();
    await db.scriviArchivio(nuovo);
    chiediPersistenza().catch(() => {});
  }
  archivio = nuovo;
  for (const fn of ascoltatori) fn(archivio);
}

export async function modifica(fn, opzioni) {
  const copia = structuredClone(archivio);
  fn(copia);
  await salva(copia, opzioni);
}

export async function cancellaTutto() {
  if (!volatile) {
    if (archivio) await db.aggiungiSnapshot(archivio, 'Prima della cancellazione di tutti i dati');
    await db.cancellaArchivio();
  }
  archivio = null;
  for (const fn of ascoltatori) fn(archivio);
}

export async function persistente() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}
