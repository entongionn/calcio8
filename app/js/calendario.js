// Lettura del calendario dal testo del Comunicato Ufficiale (copiato dal PDF).
//
// Formato atteso, come nei comunicati AICS:
//   CALENDARIO GIRONE A-B-C
//   PRIMA GIORNATA
//   Lun 26.10.2026 20.30 Petriccio SPORTING UOPINI vs CASTELLINA IN CHIANTI A
//   21.40 Petriccio ROAD TO MURLO vs ATLETICO MENTA C        (stessa data della riga sopra)
//   Nel Girone A riposa: SANT'ANDREA
//   CALENDARIO NONA GIRONE A
//   E RECUPERO OTTOVA GIORNATA GIRONE C
//
// I comunicati contengono errori (colonna girone sbagliata, date fuori posto, nomi storpiati):
// il girone si ricava sempre dalle due squadre e ogni anomalia viene segnalata, non corretta
// in silenzio.

import { normalizza, trovaSquadra } from './normalizza.js';
import { gironeComune, idPartita, totaleGiornate } from './archivio.js';

const ORDINALI = {
  prima: 1, seconda: 2, terza: 3, quarta: 4, quinta: 5, sesta: 6, settima: 7, ottava: 8, nona: 9,
  decima: 10, undicesima: 11, dodicesima: 12, tredicesima: 13, quattordicesima: 14,
  quindicesima: 15, sedicesima: 16, diciassettesima: 17, diciottesima: 18,
};
const REFUSI_ORDINALI = { ottova: 'ottava' };

const RIGA_PARTITA = new RegExp(
  '^(?:(?:lun|mar|mer|gio|ven|sab|dom)[a-zì]*\\.?\\s+)?'
  + '(?:(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})\\s+)?'
  + '(\\d{1,2})[.:](\\d{2})\\s+'
  + '(.+?)\\s+vc?s\\.?\\s+(.+?)'
  + '(?:\\s+([A-F]))?\\s*$',
  'i',
);

const errore = msg => ({ livello: 'errore', msg });
const avviso = msg => ({ livello: 'avviso', msg });
const info = msg => ({ livello: 'info', msg });

function isoData(g, m, a) {
  const anno = a.length === 2 ? `20${a}` : a;
  return `${anno}-${m.padStart(2, '0')}-${g.padStart(2, '0')}`;
}

function formatoBreve(iso) {
  const [, m, g] = iso.split('-');
  return `${g}/${m}`;
}

function separaCampo(testo, campi) {
  const n = normalizza(testo);
  const ordinati = [...campi].sort((a, b) => b.length - a.length);
  for (const c of ordinati) {
    const nc = normalizza(c);
    if (n.startsWith(`${nc} `)) {
      const parole = testo.trim().split(/\s+/);
      return { campo: c, resto: parole.slice(nc.split(' ').length).join(' '), noto: true };
    }
  }
  const parole = testo.trim().split(/\s+/);
  return { campo: parole[0], resto: parole.slice(1).join(' '), noto: false };
}

function leggiIntestazione(norm, blocco) {
  const t = norm.split(' ');
  if (t[0] === 'calendario') {
    blocco.id++;
    blocco.predefinita = null;
    blocco.perGirone = {};
    blocco.recupero = {};
  }
  for (let i = 0; i < t.length; i++) {
    const tok = REFUSI_ORDINALI[t[i]] ?? t[i];
    let g = null;
    if (tok in ORDINALI) g = ORDINALI[tok];
    else {
      const m = /^(\d{1,2})a?$/.exec(tok);
      if (m) g = Number(m[1]);
    }
    // L'ordinale deve essere seguito da "giornata" o "girone", per non confonderlo con il testo libero.
    if (g == null || (t[i + 1] !== 'giornata' && t[i + 1] !== 'girone')) continue;
    let j = i + 1;
    if (t[j] === 'giornata') j++;
    const girone = t[j] === 'girone' && /^[a-z]$/.test(t[j + 1] ?? '') ? t[j + 1].toUpperCase() : null;
    const recupero = t.slice(Math.max(0, i - 2), i).includes('recupero');
    if (girone) {
      blocco.perGirone[girone] = g;
      if (recupero) blocco.recupero[girone] = true;
    } else {
      blocco.predefinita = g;
    }
  }
}

/**
 * Ricostruisce gli a capo quando il testo copiato dal PDF arriva su un'unica riga:
 * va a capo prima di "CALENDARIO", di "Nel Girone X riposa", di "Lun 02.11.2026" e
 * di un orario che non segue una data ("21.40 Petriccio ..."). Sul testo già diviso
 * in righe non cambia nulla.
 */
export function separaRighe(testo) {
  return String(testo)
    .replace(/\s+(?=calendario\b)/giu, '\n')
    .replace(/\s+(?=nel\s+girone\s+[a-f]\s+riposa)/giu, '\n')
    .replace(/\s+(?=(?:lun|mar|mer|gio|ven|sab|dom)[a-zì]*\.?\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s)/giu, '\n')
    .replace(/(?<!\d{4}\s*)\s+(?=\d{1,2}[.:]\d{2}\s+\p{L})/gu, '\n')
    .split('\n')
    .map(r => r.trim())
    .join('\n');
}

function copiaBlocco(b) {
  return { id: b.id, predefinita: b.predefinita, perGirone: { ...b.perGirone }, recupero: { ...b.recupero } };
}

/** Prima lettura del testo: individua righe di partita, riposi e righe non interpretate. */
export function leggiCalendario(testo, archivio) {
  const blocco = { id: 0, predefinita: null, perGirone: {}, recupero: {} };
  const righe = [];
  const riposi = [];
  const nonRiconosciute = [];
  let dataCorrente = null;

  separaRighe(testo).split(/\r?\n/).forEach((grezza, indice) => {
    const linea = grezza.trim();
    if (!linea) return;
    const riga = indice + 1;

    const m = RIGA_PARTITA.exec(linea);
    if (m) {
      const [, gg, mm, aa, hh, min, campoECasa, ospiteTesto, gironeColonna] = m;
      if (gg) dataCorrente = isoData(gg, mm, aa);
      const { campo, resto, noto } = separaCampo(campoECasa, archivio.campi ?? []);
      const casa = trovaSquadra(resto, archivio.squadre);
      const ospite = trovaSquadra(ospiteTesto, archivio.squadre);
      righe.push({
        riga, testo: linea, intestazione: copiaBlocco(blocco),
        data: dataCorrente, ora: `${hh.padStart(2, '0')}:${min}`, campo, campoNoto: noto,
        casaTesto: resto, ospiteTesto: ospiteTesto.trim(),
        casa: casa?.squadra.id ?? null, ospite: ospite?.squadra.id ?? null,
        riconoscimento: { casa: casa?.tipo ?? null, ospite: ospite?.tipo ?? null },
        gironeColonna: gironeColonna ? gironeColonna.toUpperCase() : null,
        giornata: null, giornataModificata: false, recupero: false,
      });
      return;
    }

    const r = /riposa\s*:?\s*(.+)$/i.exec(linea);
    if (r) {
      const g = /girone\s+([a-f])\b/i.exec(linea);
      const s = trovaSquadra(r[1], archivio.squadre);
      const girone = g ? g[1].toUpperCase() : null;
      riposi.push({
        riga, testo: linea, girone, squadra: s?.squadra.id ?? null,
        giornata: (girone && blocco.perGirone[girone]) ?? blocco.predefinita,
      });
      return;
    }

    if (/\svc?s\.?\s/i.test(linea)) {
      nonRiconosciute.push({ riga, testo: linea });
      return;
    }

    const idPrima = blocco.id;
    leggiIntestazione(normalizza(linea), blocco);
    if (blocco.id !== idPrima) dataCorrente = null;
  });

  return { righe, riposi, nonRiconosciute, avvisiGenerali: [] };
}

/**
 * Controlla le righe lette (anche dopo le correzioni fatte a mano) e calcola per ognuna
 * girone, giornata, avvisi ed esito rispetto all'archivio: 'nuova', 'modificata', 'invariata', 'errore'.
 */
export function validaCalendario(analisi, archivio) {
  const nomeDi = id => archivio.squadre.find(s => s.id === id)?.nome ?? id;
  const gironeDa = id => archivio.gironi.find(g => g.id === id);

  for (const r of analisi.righe) {
    r.avvisi = [];
    r.suggerimento = null;
    for (const lato of ['casa', 'ospite']) {
      const testo = r[`${lato}Testo`];
      if (!r[lato]) r.avvisi.push(errore(`Squadra non riconosciuta: «${testo}»`));
      else if (r.riconoscimento[lato] && r.riconoscimento[lato] !== 'esatta' && !r.riconoscimento[`${lato}Manuale`]) {
        r.avvisi.push(info(`«${testo}» letta come ${nomeDi(r[lato])}`));
      }
    }
    r.girone = null;
    if (r.casa && r.ospite) {
      if (r.casa === r.ospite) r.avvisi.push(errore('La stessa squadra compare due volte'));
      else {
        r.girone = gironeComune(archivio, r.casa, r.ospite);
        if (!r.girone) r.avvisi.push(errore(`${nomeDi(r.casa)} e ${nomeDi(r.ospite)} non sono nello stesso girone`));
      }
    }
    if (r.girone && r.gironeColonna && r.gironeColonna !== r.girone) {
      r.avvisi.push(info(`Il comunicato indica il girone ${r.gironeColonna}, ma le squadre sono del girone ${r.girone}`));
    }
    r.id = r.girone ? idPartita(r.girone, r.casa, r.ospite) : null;
    r.giornataMantenuta = false;
    if (!r.giornataModificata) {
      const h = r.intestazione;
      r.giornata = (r.girone && h.perGirone[r.girone]) ?? h.predefinita;
      r.recupero = Boolean(r.girone && h.recupero[r.girone]);
      // Una giornata già corretta a mano non viene riportata all'errore del comunicato successivo.
      const esistente = r.id && archivio.partite.find(p => p.id === r.id);
      if (esistente?.giornataCorretta && r.giornata && esistente.giornata !== r.giornata) {
        r.avvisi.push(info(`Il comunicato indica la ${r.giornata}ª giornata: resta la ${esistente.giornata}ª, corretta in precedenza`));
        r.giornata = esistente.giornata;
        r.giornataMantenuta = true;
      }
    }
    if (!r.giornata) r.avvisi.push(errore('Giornata non indicata'));
    else if (r.girone && r.giornata > totaleGiornate(gironeDa(r.girone))) {
      r.avvisi.push(avviso(`Il girone ${r.girone} ha solo ${totaleGiornate(gironeDa(r.girone))} giornate`));
    }
    if (!r.data) r.avvisi.push(avviso('Data mancante'));
    if (!r.campoNoto) r.avvisi.push(info(`Campo «${r.campo}» non presente nell'elenco dei campi`));
  }

  // Date fuori sequenza all'interno della stessa giornata del comunicato.
  const massime = new Map();
  for (const r of analisi.righe) {
    if (!r.data) continue;
    const max = massime.get(r.intestazione.id);
    if (max && r.data < max) {
      r.avvisi.push(avviso(`Data ${formatoBreve(r.data)} precedente a quelle elencate prima: possibile errore del comunicato`));
    } else {
      massime.set(r.intestazione.id, r.data);
    }
  }

  // Stessa partita ripetuta nel testo.
  const perId = new Map();
  for (const r of analisi.righe) {
    if (!r.id) continue;
    if (!perId.has(r.id)) perId.set(r.id, []);
    perId.get(r.id).push(r);
  }
  for (const gruppo of perId.values()) {
    if (gruppo.length < 2) continue;
    for (const r of gruppo) {
      r.avvisi.push(errore(`Partita ripetuta nel testo (righe ${gruppo.map(x => x.riga).join(', ')})`));
    }
  }

  // Squadre che giocano due volte nella stessa giornata: archivio + righe importate.
  const combinate = new Map();
  for (const p of archivio.partite) if (p.competizione === 'campionato') combinate.set(p.id, p);
  for (const r of analisi.righe) {
    if (r.id && r.giornata) combinate.set(r.id, { id: r.id, girone: r.girone, giornata: r.giornata, casa: r.casa, ospite: r.ospite });
  }
  const occupazione = new Map();
  for (const p of combinate.values()) {
    const k = `${p.girone}|${p.giornata}`;
    if (!occupazione.has(k)) occupazione.set(k, { partite: 0, squadre: new Map() });
    const o = occupazione.get(k);
    o.partite++;
    for (const s of [p.casa, p.ospite]) o.squadre.set(s, (o.squadre.get(s) ?? 0) + 1);
  }
  for (const r of analisi.righe) {
    if (!r.id || !r.giornata) continue;
    const o = occupazione.get(`${r.girone}|${r.giornata}`);
    const doppie = [r.casa, r.ospite].filter(s => o.squadre.get(s) > 1);
    if (!doppie.length) continue;
    r.avvisi.push(avviso(`${doppie.map(nomeDi).join(' e ')} ${doppie.length > 1 ? 'giocano' : 'gioca'} due volte nella ${r.giornata}ª giornata del girone ${r.girone}`));

    const girone = gironeDa(r.girone);
    const perGiornata = Math.floor(girone.squadre.length / 2);
    const candidate = [];
    for (let g = 1; g <= totaleGiornate(girone); g++) {
      const og = occupazione.get(`${r.girone}|${g}`);
      if (g === r.giornata || !og) continue;
      if (og.squadre.has(r.casa) || og.squadre.has(r.ospite) || og.partite >= perGiornata) continue;
      candidate.push(g);
    }
    if (candidate.length === 1) {
      r.suggerimento = candidate[0];
      r.avvisi.push(avviso(`Probabilmente appartiene alla ${candidate[0]}ª giornata, dove entrambe le squadre mancano`));
    }
  }

  // Riposi: la squadra che riposa non deve giocare in quella giornata.
  analisi.avvisiGenerali = [];
  for (const rp of analisi.riposi) {
    if (!rp.squadra || !rp.giornata || !rp.girone) continue;
    const o = occupazione.get(`${rp.girone}|${rp.giornata}`);
    if (o?.squadre.has(rp.squadra)) {
      analisi.avvisiGenerali.push(avviso(`Riga ${rp.riga}: ${nomeDi(rp.squadra)} dovrebbe riposare nella ${rp.giornata}ª giornata del girone ${rp.girone}, ma ha una partita`));
    }
  }
  for (const nr of analisi.nonRiconosciute) {
    analisi.avvisiGenerali.push(errore(`Riga ${nr.riga} non interpretata: «${nr.testo}»`));
  }

  // Esito rispetto all'archivio.
  for (const r of analisi.righe) {
    r.differenze = [];
    if (r.avvisi.some(a => a.livello === 'errore')) {
      r.esito = 'errore';
      continue;
    }
    const esistente = archivio.partite.find(p => p.id === r.id);
    if (!esistente) {
      r.esito = 'nuova';
      continue;
    }
    for (const campo of ['giornata', 'data', 'ora', 'campo']) {
      if ((esistente[campo] ?? null) !== (r[campo] ?? null)) r.differenze.push({ campo, prima: esistente[campo] ?? null, dopo: r[campo] ?? null });
    }
    r.esito = r.differenze.length ? 'modificata' : 'invariata';
  }
  return analisi;
}

export function analizzaCalendario(testo, archivio) {
  return validaCalendario(leggiCalendario(testo, archivio), archivio);
}

/** Aggiunge o aggiorna le partite. Non tocca mai risultati e stato delle partite già presenti. */
export function applicaCalendario(archivio, righe) {
  const out = structuredClone(archivio);
  let aggiunte = 0;
  let aggiornate = 0;
  for (const r of righe) {
    const giornataCorretta = Boolean(r.giornataModificata || r.giornataMantenuta);
    if (r.esito === 'nuova') {
      out.partite.push({
        id: r.id, competizione: 'campionato', girone: r.girone, giornata: r.giornata, giornataCorretta, recupero: r.recupero,
        casa: r.casa, ospite: r.ospite, data: r.data, ora: r.ora, campo: r.campo,
        stato: 'programmata', gol: null, ufficiale: false, fonte: null,
      });
      aggiunte++;
    } else if (r.esito === 'modificata') {
      const p = out.partite.find(x => x.id === r.id);
      Object.assign(p, { giornata: r.giornata, giornataCorretta, recupero: r.recupero, data: r.data, ora: r.ora, campo: r.campo });
      aggiornate++;
    }
    if (r.esito === 'nuova' || r.esito === 'modificata') {
      if (r.campo && !out.campi.includes(r.campo)) out.campi.push(r.campo);
    }
  }
  return { archivio: out, aggiunte, aggiornate };
}
