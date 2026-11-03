// Struttura dell'archivio e operazioni pure su di esso: creazione, verifica di un backup,
// confronto e unione di due archivi. L'archivio è un unico oggetto JSON: è lo stesso
// formato usato per il salvataggio sul dispositivo, per i backup e per la pubblicazione.

import { slug } from './normalizza.js';

export const FORMATO = 'aics-calcio8';
// Versione 2: aggiunti i giocatori e gli eventi delle partite (marcatori, ammoniti, espulsi).
export const VERSIONE_SCHEMA = 2;

// Collezioni di record identificati da `id`. L'id di una partita è derivato da
// girone + casa + ospite, quello di un giocatore da squadra + nome: due copie dello
// stesso record hanno quindi lo stesso id.
export const COLLEZIONI = ['squadre', 'competizioni', 'gironi', 'partite', 'penalita', 'giocatori'];

export const STATI_PARTITA = {
  programmata: 'Da giocare',
  giocata: 'Giocata',
  tavolino: 'Vinta a tavolino',
  rinviata: 'Rinviata',
  annullata: 'Annullata',
};

export function archivioVuoto() {
  return {
    formato: FORMATO,
    versioneSchema: VERSIONE_SCHEMA,
    aggiornato: null,
    stagione: null,
    campi: [],
    squadre: [],
    competizioni: [],
    gironi: [],
    partite: [],
    penalita: [],
    // { id, nome, squadra, alias }: alias sono le altre grafie dello stesso nome.
    giocatori: [],
    // Ordine stabilito per sorteggio, per girone: { A: ['id1', 'id2'] }.
    sorteggi: {},
  };
}

export function archivioDaSeed(seed) {
  return { ...archivioVuoto(), ...structuredClone(seed), aggiornato: new Date().toISOString() };
}

/** Porta un archivio (salvato o da backup) di una versione precedente al formato attuale. */
export function migraArchivio(dati) {
  if (!dati || typeof dati !== 'object' || dati.formato !== FORMATO) return dati;
  if (!(dati.versioneSchema >= 1) || dati.versioneSchema >= VERSIONE_SCHEMA) return dati;
  const out = structuredClone(dati);
  if (!Array.isArray(out.giocatori)) out.giocatori = [];
  out.versioneSchema = VERSIONE_SCHEMA;
  return out;
}

export function idGiocatore(squadra, nome) {
  return `${squadra}:${slug(nome)}`;
}

export function idPartita(girone, casa, ospite) {
  return `${girone}:${casa}:${ospite}`;
}

export function giornatePerAndata(girone) {
  const n = girone.squadre.length;
  return n % 2 ? n : n - 1;
}

export function totaleGiornate(girone) {
  return giornatePerAndata(girone) * (girone.formula === 'andata-ritorno' ? 2 : 1);
}

export function isRitorno(girone, giornata) {
  return girone.formula === 'andata-ritorno' && giornata > giornatePerAndata(girone);
}

export function gironeComune(archivio, a, b, { competizione = 'campionato', fase = 'fase1' } = {}) {
  const g = archivio.gironi.find(x => x.competizione === competizione && (!fase || x.fase === fase)
    && x.squadre.includes(a) && x.squadre.includes(b));
  return g?.id ?? null;
}

export function nomiSquadre(archivio) {
  return Object.fromEntries(archivio.squadre.map(s => [s.id, s.nome]));
}

/** Controlla che un oggetto letto da un file sia un archivio valido. Restituisce l'elenco degli errori. */
export function verificaArchivio(dati) {
  const errori = [];
  if (!dati || typeof dati !== 'object') return ['Il file non contiene un oggetto JSON.'];
  if (dati.formato !== FORMATO) errori.push('Il file non è un backup di questa app.');
  if (typeof dati.versioneSchema !== 'number' || dati.versioneSchema > VERSIONE_SCHEMA) {
    errori.push('Il backup è stato creato da una versione più recente dell\'app: aggiorna l\'app prima di importarlo.');
  }
  for (const c of COLLEZIONI) {
    if (!Array.isArray(dati[c])) errori.push(`Manca l'elenco «${c}».`);
    else if (dati[c].some(x => !x || typeof x.id !== 'string')) errori.push(`L'elenco «${c}» contiene elementi senza id.`);
  }
  if (errori.length) return errori;

  const squadre = new Set(dati.squadre.map(s => s.id));
  const gironi = new Set(dati.gironi.map(g => g.id));
  for (const p of dati.partite) {
    if (!gironi.has(p.girone)) errori.push(`La partita ${p.id} fa riferimento a un girone inesistente.`);
    if (!squadre.has(p.casa) || !squadre.has(p.ospite)) errori.push(`La partita ${p.id} fa riferimento a una squadra inesistente.`);
  }
  return errori.slice(0, 20);
}

// Confronto indipendente dall'ordine delle chiavi.
function canonico(valore) {
  if (Array.isArray(valore)) return `[${valore.map(canonico).join(',')}]`;
  if (valore && typeof valore === 'object') {
    return `{${Object.keys(valore).filter(k => valore[k] !== undefined).sort()
      .map(k => `${JSON.stringify(k)}:${canonico(valore[k])}`).join(',')}}`;
  }
  return JSON.stringify(valore);
}

export function uguali(a, b) {
  return canonico(a) === canonico(b);
}

/**
 * Confronta l'archivio sul dispositivo con uno da importare.
 * Per ogni collezione: record nuovi, identici, diversi e presenti solo sul dispositivo.
 */
export function confrontaArchivi(mio, altro) {
  const esito = { collezioni: {}, stagioneDiversa: false, sorteggiDiversi: 0 };
  for (const nome of COLLEZIONI) {
    const miei = new Map((mio?.[nome] ?? []).map(x => [x.id, x]));
    const r = { nuovi: 0, uguali: 0, diversi: [], soloMiei: 0 };
    const visti = new Set();
    for (const x of altro[nome] ?? []) {
      visti.add(x.id);
      const m = miei.get(x.id);
      if (!m) r.nuovi++;
      else if (uguali(m, x)) r.uguali++;
      else r.diversi.push({ mio: m, altro: x });
    }
    r.soloMiei = [...miei.keys()].filter(id => !visti.has(id)).length;
    esito.collezioni[nome] = r;
  }
  esito.stagioneDiversa = Boolean(mio?.stagione && altro.stagione && mio.stagione.id !== altro.stagione.id);
  for (const [g, ordine] of Object.entries(altro.sorteggi ?? {})) {
    if (mio?.sorteggi?.[g] && !uguali(mio.sorteggi[g], ordine)) esito.sorteggiDiversi++;
  }
  return esito;
}

/**
 * Unisce due archivi senza duplicati (stesso id = stesso record).
 * `prevale` indica quale versione tenere quando lo stesso record è diverso: 'altro' o 'mio'.
 */
export function unisciArchivi(mio, altro, prevale = 'altro') {
  const out = structuredClone(mio);
  for (const nome of COLLEZIONI) {
    const indice = new Map(out[nome].map((x, i) => [x.id, i]));
    for (const x of altro[nome] ?? []) {
      if (!indice.has(x.id)) {
        indice.set(x.id, out[nome].length);
        out[nome].push(structuredClone(x));
      } else if (prevale === 'altro') {
        out[nome][indice.get(x.id)] = structuredClone(x);
      }
    }
  }
  out.campi = [...new Set([...(out.campi ?? []), ...(altro.campi ?? [])])];
  out.sorteggi ??= {};
  for (const [g, ordine] of Object.entries(altro.sorteggi ?? {})) {
    if (!out.sorteggi[g] || prevale === 'altro') out.sorteggi[g] = [...ordine];
  }
  out.stagione ??= altro.stagione;
  return out;
}
