// Lettura dei post Facebook con i risultati delle partite, come quelli pubblicati dal comitato:
//
//   1^ GIORNATA - GIRONE B
//   Artico Senese - Avis Asta Taverne 3-2
//   Per l'Artico Senese reti di Mazzoni Massimo, Bindi Niccolò e Chierici Lorenzo.
//   Per l'Avis Asta Taverne doppietta di Abbate Giuseppe.
//   Ammoniti: Gigli Lorenzo (Artico Senese) e Natale Pasquale (Avis)
//   Espulsi: Chierici Alessandro (Artico Senese)
//   Arbitro: Vigni Filippo
//
// Il risultato importato è provvisorio: quello ufficiale arriva con il Comunicato.
// Niente viene salvato senza revisione; ogni riga non capita viene mostrata.

import { chiave, distanza, trovaSquadra } from './normalizza.js';
import { gironeComune, idGiocatore, idPartita } from './archivio.js';

const ORDINALI = {
  prima: 1, seconda: 2, terza: 3, quarta: 4, quinta: 5, sesta: 6, settima: 7, ottava: 8, nona: 9, decima: 10,
  undicesima: 11, dodicesima: 12, tredicesima: 13, quattordicesima: 14,
};

const INTESTAZIONE = new RegExp(
  `\\b(\\d{1,2}|${Object.keys(ORDINALI).join('|')})\\s*(?:[°ª^'’\`]|a\\b)?\\s*giornata\\b(?:.*?\\bgirone\\s+([a-f])\\b)?`, 'i',
);
const RISULTATO = /^(.+?)\s*[-–—]\s*(.+?)\s+(\d{1,2})\s*[-–—:]\s*(\d{1,2})\s*\.?$/;
const RIGA_SQUADRA = /^per\s+(?:(?:il|lo|la|i|gli|le)\s+|l['’]\s*)?(.+?)\s+(?=(?:autoret[ei]|autogol|doppiett[ae]|triplett[ae]|poker|cinquina|manita|ret[ei]|goal|gol)\b)(.*)$/i;
const PAROLA_GOL = /\b(autoret[ei]|autogol|doppiett[ae]|triplett[ae]|poker|cinquina|manita|ret[ei]|goal|gol)\b/gi;
const ETICHETTA = /^(ammonit[io]|espuls[io]|arbitro)\s*:\s*(.*)$/i;
const DA_IGNORARE = /^(vedi (meno|altro|traduzione)|mi piace|commenta|condividi|rispondi)\b/i;

const GOL_PER_PAROLA = { doppietta: 2, doppiette: 2, tripletta: 3, triplette: 3, poker: 4, cinquina: 5, manita: 5 };

const errore = msg => ({ livello: 'errore', msg });
const avviso = msg => ({ livello: 'avviso', msg });
const info = msg => ({ livello: 'info', msg });

function pulisciRiga(riga) {
  return riga.replace(/\s*(?:…|\.\.\.)?\s*vedi (?:meno|altro)\s*$/i, '').replace(/\s+/g, ' ').trim();
}

// Divide su virgole, punti e virgola e " e " che non sono dentro parentesi.
function dividiElenco(testo) {
  const parti = [];
  let corrente = '';
  let profondita = 0;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (c === '(') profondita++;
    if (c === ')') profondita = Math.max(0, profondita - 1);
    const separatoreE = profondita === 0 && /\s/.test(c) && /^\s(?:e|ed)\s/i.test(testo.slice(i, i + 4));
    if (profondita === 0 && (c === ',' || c === ';')) {
      parti.push(corrente);
      corrente = '';
    } else if (separatoreE) {
      parti.push(corrente);
      corrente = '';
      i += testo.slice(i, i + 4).match(/^\s(?:e|ed)\s/i)[0].length - 1;
    } else {
      corrente += c;
    }
  }
  parti.push(corrente);
  return parti.map(p => p.trim().replace(/[.\s]+$/, '')).filter(Boolean);
}

/** "reti di Mazzoni Massimo, Bindi Niccolò e Chierici Lorenzo" → [{ nome, gol }...] */
export function leggiMarcatori(testo) {
  const parole = [...testo.matchAll(PAROLA_GOL)];
  const out = [];
  parole.forEach((m, i) => {
    const parola = m[1].toLowerCase();
    const fine = i + 1 < parole.length ? parole[i + 1].index : testo.length;
    let nomi = testo.slice(m.index + m[0].length, fine);
    // "rete vittoria di X", "rete del pareggio di X": i nomi seguono il primo "di".
    const di = nomi.search(/\bdi\s/i);
    if (di >= 0) nomi = nomi.slice(di + 3);
    nomi = nomi.replace(/^\s*(?:,|\be\b|\bed\b)\s*/i, '');
    const autorete = /^auto/.test(parola);
    for (let nome of dividiElenco(nomi)) {
      let gol = GOL_PER_PAROLA[parola] ?? 1;
      const conteggio = /\s*\((\d{1,2})\)|\s+x\s*(\d{1,2})\b/i.exec(nome);
      if (conteggio) {
        gol = Number(conteggio[1] ?? conteggio[2]);
        nome = nome.replace(conteggio[0], '');
      }
      const rigore = /\b(?:su\s+rigore|rig\.?|\(r\))/i.test(nome);
      nome = nome.replace(/\(?\b(?:su\s+rigore|rig\.?)\)?|\(r\)/gi, '').replace(/\s+/g, ' ').trim();
      if (!nome || /^(nessun[oa]?|nessuna rete)$/i.test(nome)) continue;
      out.push({ nome, gol, autorete, rigore });
    }
  });
  return out;
}

/** "Gigli Lorenzo (Artico Senese) e Natale Pasquale (Avis)" → [{ nome, squadraTesto }] */
export function leggiPersone(testo) {
  if (/^\s*nessun[oa]?\s*\.?\s*$/i.test(testo)) return [];
  return dividiElenco(testo).map(voce => {
    const m = /^(.*?)\s*(?:\(([^)]*)\))?\s*$/.exec(voce);
    return { nome: m[1].trim(), squadraTesto: m[2]?.trim() ?? null };
  }).filter(p => p.nome && !/^nessun[oa]?$/i.test(p.nome));
}

function numeroGiornata(t) {
  return /^\d+$/.test(t) ? Number(t) : ORDINALI[t.toLowerCase()];
}

/** Divide il testo incollato nei singoli post e ne ricava i dati, senza consultare l'archivio. */
export function leggiPost(testo) {
  const post = [];
  let corrente = null;
  let intestazione = null;
  const nuovo = () => {
    corrente = {
      indice: post.length, righe: [], giornata: intestazione?.giornata ?? null, gironeIntestazione: intestazione?.girone ?? null,
      casaTesto: null, ospiteTesto: null, gol: null, marcatori: [], ammoniti: [], espulsi: [], arbitro: null, nonInterpretate: [],
    };
    post.push(corrente);
  };
  let etichetta = null;

  for (const grezza of String(testo).split(/\r?\n/)) {
    const riga = pulisciRiga(grezza);
    if (!riga || DA_IGNORARE.test(riga)) continue;

    if (/^classific/i.test(riga)) {
      nuovo();
      corrente.riepilogo = true;
      corrente.righe.push(riga);
      etichetta = 'riepilogo';
      continue;
    }

    const h = INTESTAZIONE.exec(riga);
    if (h && !RISULTATO.test(riga)) {
      intestazione = { giornata: numeroGiornata(h[1]), girone: h[2]?.toUpperCase() ?? null };
      nuovo();
      corrente.righe.push(riga);
      etichetta = null;
      continue;
    }

    const r = RISULTATO.exec(riga);
    if (r && !ETICHETTA.test(riga)) {
      if (!corrente || corrente.gol || corrente.riepilogo) nuovo();
      corrente.righe.push(riga);
      corrente.casaTesto = r[1].trim();
      corrente.ospiteTesto = r[2].trim();
      corrente.gol = { casa: Number(r[3]), ospite: Number(r[4]) };
      etichetta = null;
      continue;
    }

    if (!corrente) nuovo();
    corrente.righe.push(riga);
    if (corrente.riepilogo) continue;

    const s = RIGA_SQUADRA.exec(riga);
    if (s) {
      for (const m of leggiMarcatori(s[2])) corrente.marcatori.push({ ...m, squadraTesto: s[1] });
      etichetta = null;
      continue;
    }

    const e = ETICHETTA.exec(riga);
    if (e) {
      etichetta = e[1].toLowerCase().startsWith('ammonit') ? 'ammoniti' : e[1].toLowerCase().startsWith('espuls') ? 'espulsi' : 'arbitro';
      if (etichetta === 'arbitro') {
        corrente.arbitro = e[2].replace(/[.\s]+$/, '') || null;
        etichetta = null;
      } else {
        corrente[etichetta].push(...leggiPersone(e[2]));
      }
      continue;
    }

    // Righe successive di "Ammoniti:" o "Espulsi:" scritte a capo.
    if (etichetta === 'ammoniti' || etichetta === 'espulsi') {
      corrente[etichetta].push(...leggiPersone(riga));
      continue;
    }
    corrente.nonInterpretate.push(riga);
  }
  return post
    .filter(p => p.riepilogo || p.gol || p.marcatori.length || p.nonInterpretate.length)
    .map((p, i) => Object.assign(p, { indice: i }));
}

/** Cerca un giocatore della squadra per nome; accetta piccole differenze di grafia ("Meldin"/"Heldin"). */
export function trovaGiocatore(nome, squadra, giocatori) {
  const k = chiave(nome);
  const dellaSquadra = giocatori.filter(g => g.squadra === squadra);
  const esatto = dellaSquadra.find(g => [g.nome, ...(g.alias ?? [])].some(n => chiave(n) === k));
  if (esatto) return { giocatore: esatto, tipo: 'esatto' };
  const soglia = Math.max(1, Math.floor(k.length / 8));
  const vicini = dellaSquadra
    .map(g => ({ g, d: Math.min(...[g.nome, ...(g.alias ?? [])].map(n => distanza(k, chiave(n)))) }))
    .filter(x => x.d <= soglia)
    .sort((a, b) => a.d - b.d);
  if (vicini.length && (vicini.length === 1 || vicini[1].d > vicini[0].d)) return { giocatore: vicini[0].g, tipo: 'simile' };
  return null;
}

function squadraTra(testo, ids, archivio) {
  if (!testo) return null;
  const candidate = archivio.squadre.filter(s => ids.includes(s.id));
  return trovaSquadra(testo, candidate)?.squadra.id ?? null;
}

/**
 * Collega un post all'archivio: squadre, partita del calendario, giocatori.
 * Calcola gli avvisi e l'esito: 'nuovo', 'aggiorna', 'uguale', 'ufficiale' (diverso dal dato
 * ufficiale: non si sovrascrive), 'errore', 'riepilogo'.
 */
export function validaPost(p, archivio, { oggi = new Date().toISOString().slice(0, 10) } = {}) {
  p.avvisi = [];
  if (p.riepilogo) {
    p.esito = 'riepilogo';
    p.avvisi.push(info('Post di riepilogo (classifiche e marcatori): non contiene risultati da importare.'));
    return p;
  }
  const nomeDi = id => archivio.squadre.find(s => s.id === id)?.nome ?? id;

  if (!p.gol) p.avvisi.push(errore('Non trovo la riga del risultato (es. «Lornano - Monteroni 1-0»)'));
  if (!p.casaManuale) p.casa = p.casaTesto ? trovaSquadra(p.casaTesto, archivio.squadre)?.squadra.id ?? null : null;
  if (!p.ospiteManuale) p.ospite = p.ospiteTesto ? trovaSquadra(p.ospiteTesto, archivio.squadre)?.squadra.id ?? null : null;
  if (p.gol && !p.casa) p.avvisi.push(errore(`Squadra non riconosciuta: «${p.casaTesto}»`));
  if (p.gol && !p.ospite) p.avvisi.push(errore(`Squadra non riconosciuta: «${p.ospiteTesto}»`));

  p.girone = null;
  p.id = null;
  p.partita = null;
  if (p.casa && p.ospite) {
    p.girone = gironeComune(archivio, p.casa, p.ospite);
    if (!p.girone) p.avvisi.push(errore(`${nomeDi(p.casa)} e ${nomeDi(p.ospite)} non sono nello stesso girone`));
  }
  if (p.girone) {
    p.id = idPartita(p.girone, p.casa, p.ospite);
    p.partita = archivio.partite.find(x => x.id === p.id) ?? null;
    const inversa = archivio.partite.find(x => x.id === idPartita(p.girone, p.ospite, p.casa)) ?? null;
    // Squadre scritte al contrario rispetto al calendario. Con andata e ritorno esistono entrambe
    // le partite: si sceglie quella indicata dalla giornata del post o, in mancanza, dalla data.
    const scegliInversa = inversa && !p.invertito && !p.casaManuale && (
      !p.partita
      || (p.giornata && p.partita.giornata !== p.giornata && inversa.giornata === p.giornata)
      || (!p.giornata && p.partita.data > oggi && inversa.data && inversa.data <= oggi)
    );
    if (scegliInversa) {
      p.avvisi.push(avviso(`Nel calendario la partita è ${nomeDi(p.ospite)} – ${nomeDi(p.casa)}: casa e ospite (e gol) sono stati invertiti`));
      [p.casa, p.ospite] = [p.ospite, p.casa];
      [p.casaTesto, p.ospiteTesto] = [p.ospiteTesto, p.casaTesto];
      p.gol = { casa: p.gol.ospite, ospite: p.gol.casa };
      p.casaManuale = true;
      p.ospiteManuale = true;
      p.invertito = true;
      p.id = inversa.id;
      p.partita = inversa;
    }
    if (!p.partita) p.avvisi.push(errore('La partita non è nel calendario: importa prima il calendario o aggiungila da Partite'));
    if (p.gironeIntestazione && p.gironeIntestazione !== p.girone) {
      p.avvisi.push(info(`Il post indica il girone ${p.gironeIntestazione}, ma le squadre sono del girone ${p.girone}`));
    }
    if (p.partita && p.giornata && p.partita.giornata !== p.giornata) {
      p.avvisi.push(info(`Il post indica la ${p.giornata}ª giornata, nel calendario è la ${p.partita.giornata}ª`));
    }
  }

  // Squadre e giocatori di marcatori, ammoniti ed espulsi.
  const dueSquadre = [p.casa, p.ospite].filter(Boolean);
  const giocatori = archivio.giocatori ?? [];
  const collega = (voce, squadra) => {
    voce.squadra = squadra;
    voce.giocatore = null;
    voce.nuovo = false;
    if (!squadra || !voce.nome) return;
    const g = trovaGiocatore(voce.nome, squadra, giocatori);
    if (g) {
      voce.giocatore = g.giocatore.id;
      if (g.tipo === 'simile') p.avvisi.push(info(`«${voce.nome}» riconosciuto come ${g.giocatore.nome}`));
    } else {
      voce.giocatore = idGiocatore(squadra, voce.nome);
      voce.nuovo = true;
    }
  };
  for (const m of p.marcatori) {
    if (!m.squadraManuale) m.squadraGol = squadraTra(m.squadraTesto, dueSquadre, archivio);
    if (!m.squadraGol) p.avvisi.push(errore(`Non capisco a quale squadra vanno i gol di ${m.nome} («${m.squadraTesto}»)`));
    // In un'autorete il giocatore è della squadra avversaria.
    const delGiocatore = m.autorete ? dueSquadre.find(s => s !== m.squadraGol) ?? null : m.squadraGol;
    collega(m, delGiocatore);
  }
  for (const tipo of ['ammoniti', 'espulsi']) {
    for (const x of p[tipo]) {
      if (!x.squadraManuale) x.squadraIndicata = squadraTra(x.squadraTesto, dueSquadre, archivio);
      if (!x.squadraIndicata) p.avvisi.push(avviso(`${tipo === 'ammoniti' ? 'Ammonito' : 'Espulso'} ${x.nome}: squadra ${x.squadraTesto ? `«${x.squadraTesto}» non riconosciuta` : 'non indicata'}`));
      collega(x, x.squadraIndicata);
    }
  }

  // I gol dei marcatori devono tornare con il risultato.
  p.nonAttribuiti = null;
  if (p.gol && p.casa && p.ospite) {
    const somma = s => p.marcatori.filter(m => m.squadraGol === s).reduce((n, m) => n + m.gol, 0);
    const casa = p.gol.casa - somma(p.casa);
    const ospite = p.gol.ospite - somma(p.ospite);
    for (const [s, diff] of [[p.casa, casa], [p.ospite, ospite]]) {
      if (diff > 0) p.avvisi.push(avviso(`${nomeDi(s)}: ${diff} gol senza marcatore`));
      if (diff < 0) p.avvisi.push(avviso(`${nomeDi(s)}: i marcatori indicano ${-diff} gol in più del risultato`));
    }
    p.nonAttribuiti = { casa: Math.max(0, casa), ospite: Math.max(0, ospite) };
  }
  if (p.nonInterpretate.length) p.avvisi.push(info(`Righe non interpretate: ${p.nonInterpretate.map(r => `«${r}»`).join(', ')}`));

  // Esito rispetto a quanto già salvato.
  if (p.avvisi.some(a => a.livello === 'errore')) {
    p.esito = 'errore';
  } else if (!p.partita.gol || p.partita.stato === 'programmata' || p.partita.stato === 'rinviata') {
    p.esito = 'nuovo';
  } else if (p.partita.gol.casa === p.gol.casa && p.partita.gol.ospite === p.gol.ospite) {
    p.esito = p.partita.eventi ? 'uguale' : 'aggiorna';
  } else if (p.partita.ufficiale) {
    p.esito = 'ufficiale';
    p.avvisi.push(avviso(`Il risultato ufficiale salvato è ${p.partita.gol.casa}–${p.partita.gol.ospite}: non viene sovrascritto`));
  } else {
    p.esito = 'aggiorna';
    p.avvisi.push(info(`Sostituisce il risultato provvisorio ${p.partita.gol.casa}–${p.partita.gol.ospite}`));
  }
  return p;
}

export function analizzaPost(testo, archivio, opzioni) {
  return leggiPost(testo).map(p => validaPost(p, archivio, opzioni));
}

/**
 * Salva un post nell'archivio come risultato provvisorio, con marcatori e cartellini.
 * Un dato ufficiale (dal Comunicato) non viene mai sovrascritto.
 */
export function applicaPost(archivio, p) {
  if (!['nuovo', 'aggiorna'].includes(p.esito)) return archivio;
  const out = structuredClone(archivio);
  out.giocatori ??= [];
  const partita = out.partite.find(x => x.id === p.id);

  const registra = voce => {
    if (!voce.giocatore) return null;
    const esistente = out.giocatori.find(g => g.id === voce.giocatore);
    if (!esistente) {
      out.giocatori.push({ id: voce.giocatore, nome: voce.nome, squadra: voce.squadra, alias: [] });
    } else if (chiave(esistente.nome) !== chiave(voce.nome) && !(esistente.alias ?? []).some(a => chiave(a) === chiave(voce.nome))) {
      // Grafia diversa dello stesso giocatore: la si ricorda per le prossime volte.
      esistente.alias = [...(esistente.alias ?? []), voce.nome];
    }
    return voce.giocatore;
  };

  // Se il risultato ufficiale coincide, il post aggiunge solo marcatori e cartellini.
  const confermaUfficiale = Boolean(partita.ufficiale && partita.gol
    && partita.gol.casa === p.gol.casa && partita.gol.ospite === p.gol.ospite);
  Object.assign(partita, {
    stato: 'giocata',
    gol: { ...p.gol },
    ufficiale: confermaUfficiale,
    fonte: confermaUfficiale ? partita.fonte : 'facebook',
    arbitro: p.arbitro ?? partita.arbitro ?? null,
    eventi: {
      marcatori: p.marcatori.filter(m => m.squadraGol).map(m => ({
        giocatore: registra(m), squadra: m.squadraGol, gol: m.gol, autorete: m.autorete || undefined, rigore: m.rigore || undefined,
      })),
      ammoniti: p.ammoniti.map(x => ({ giocatore: registra(x), nome: x.nome, squadra: x.squadra })),
      espulsi: p.espulsi.map(x => ({ giocatore: registra(x), nome: x.nome, squadra: x.squadra })),
      nonAttribuiti: p.nonAttribuiti,
    },
  });
  return out;
}
