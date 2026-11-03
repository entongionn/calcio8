// Stato dell'app: l'archivio in memoria, il suo salvataggio, le copie di sicurezza e
// l'allineamento con i dati pubblicati. Ogni modifica passa da `modifica()`, che lavora su
// una copia e la salva tutta insieme.
//
// Ruoli: chi ha un token GitHub su questo telefono è l'amministratore e ogni modifica viene
// pubblicata da sola; tutti gli altri consultano i dati pubblicati, in sola lettura.

import * as db from './db.js';
import { migraArchivio } from './archivio.js';
import { decidiSincronizzazione, pubblica, scaricaPubblicati, verificaToken } from './pubblica.js';

const ATTESA_PUBBLICAZIONE = 1500;

let archivio = null;
let volatile = false;
let token = null;
const ascoltatori = new Set();

// Stato della pubblicazione: 'ok' | 'in-corso' | 'da-pubblicare' | 'errore'
let pubblicazione = { stato: 'ok', quando: null, errore: null };
const ascoltatoriPubblicazione = new Set();
let timerPubblicazione = null;

export const corrente = () => archivio;
export const isVolatile = () => volatile;
export const isAmministratore = () => Boolean(token);
export const statoPubblicazione = () => pubblicazione;

export function ascolta(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

export function ascoltaPubblicazione(fn) {
  ascoltatoriPubblicazione.add(fn);
  return () => ascoltatoriPubblicazione.delete(fn);
}

function notifica() {
  for (const fn of ascoltatori) fn(archivio);
}

function aggiornaPubblicazione(cambi) {
  pubblicazione = { ...pubblicazione, ...cambi };
  for (const fn of ascoltatoriPubblicazione) fn(pubblicazione);
}

export async function carica() {
  if (!(await db.disponibile())) {
    volatile = true;
    return null;
  }
  archivio = migraArchivio((await db.leggiArchivio()) ?? null);
  token = (await db.leggiImpostazione('tokenGitHub')) ?? null;
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

// Sostituisce l'archivio così com'è (senza cambiarne la data), es. con quello pubblicato.
async function sostituisci(nuovo, copiaPrima = null) {
  if (!volatile) {
    if (copiaPrima && archivio) await db.aggiungiSnapshot(archivio, copiaPrima);
    await db.scriviArchivio(nuovo);
  }
  archivio = nuovo;
  notifica();
}

/**
 * Salva una nuova versione dell'archivio. Con `copiaPrima` salva prima una copia di sicurezza
 * dell'archivio attuale con quella descrizione; altrimenti ne crea al più una al giorno.
 * Sul telefono dell'amministratore la modifica viene poi pubblicata da sola.
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
  notifica();
  if (token) programmaPubblicazione();
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
  notifica();
}

export async function persistente() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}

// --- Pubblicazione e allineamento ---

function programmaPubblicazione() {
  clearTimeout(timerPubblicazione);
  aggiornaPubblicazione({ stato: 'da-pubblicare', errore: null });
  timerPubblicazione = setTimeout(() => pubblicaOra(), ATTESA_PUBBLICAZIONE);
}

/** Pubblica subito l'archivio. Restituisce true se riuscito. */
export async function pubblicaOra() {
  clearTimeout(timerPubblicazione);
  if (!token || !archivio) return false;
  const daPubblicare = archivio;
  aggiornaPubblicazione({ stato: 'in-corso', errore: null });
  try {
    await pubblica(daPubblicare, token);
    await db.scriviImpostazione('basePubblicata', daPubblicare.aggiornato);
    // Se nel frattempo è arrivata un'altra modifica, si pubblica anche quella.
    if (archivio !== daPubblicare) {
      programmaPubblicazione();
    } else {
      aggiornaPubblicazione({ stato: 'ok', quando: new Date().toISOString() });
    }
    return true;
  } catch (e) {
    aggiornaPubblicazione({ stato: 'errore', errore: e.message });
    return false;
  }
}

/** Allinea il telefono con i dati pubblicati (all'avvio e al ritorno della connessione). */
export async function sincronizza() {
  if (volatile) return;
  const remoto = await scaricaPubblicati();
  const base = (await db.leggiImpostazione('basePubblicata')) ?? null;
  const decisione = decidiSincronizzazione(archivio, remoto, base, Boolean(token));
  if (decisione.azione === 'usa-remoto') {
    await sostituisci(decisione.archivio, token ? 'Prima dell\'aggiornamento con i dati pubblicati' : null);
    await db.scriviImpostazione('basePubblicata', decisione.archivio.aggiornato);
  } else if (decisione.azione === 'unisci') {
    await salva(decisione.archivio, { copiaPrima: 'Prima dell\'unione con i dati pubblicati' });
  } else if (decisione.azione === 'pubblica') {
    await pubblicaOra();
  }
}

/**
 * Rende questo telefono l'amministratore. Se esistono già dati pubblicati li adotta
 * (quelli del telefono restano nelle copie automatiche), altrimenti pubblica quelli del telefono.
 * Restituisce un messaggio d'errore o null.
 */
export async function impostaToken(nuovo) {
  const pulito = nuovo.trim();
  const errore = await verificaToken(pulito);
  if (errore) return errore;
  await db.scriviImpostazione('tokenGitHub', pulito);
  token = pulito;
  const remoto = await scaricaPubblicati();
  if (remoto) {
    await sostituisci(remoto, archivio ? 'Dati del telefono prima di diventare amministratore' : null);
    await db.scriviImpostazione('basePubblicata', remoto.aggiornato);
  } else if (archivio) {
    await pubblicaOra();
  }
  notifica();
  return null;
}

export async function rimuoviToken() {
  await db.scriviImpostazione('tokenGitHub', null);
  token = null;
  clearTimeout(timerPubblicazione);
  aggiornaPubblicazione({ stato: 'ok', errore: null });
  notifica();
}
