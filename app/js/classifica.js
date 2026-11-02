// Classifica di un girone all'italiana secondo il Par.2 del regolamento provinciale.
//
// A pari punti tra due squadre:        A pari punti tra tre o più squadre:
//   1. scontri diretti                   1. classifica avulsa
//   2. differenza reti scontri diretti   2. differenza reti nella classifica avulsa
//   3. differenza reti                   3. differenza reti
//   4. reti realizzate                   4. reti realizzate
//   5. classifica Fair-Play              5. classifica Fair-Play
//   6. sorteggio                         6. sorteggio
//
// Per due squadre la classifica avulsa coincide con gli scontri diretti, quindi il calcolo è
// lo stesso. Se un criterio separa solo una parte del gruppo, al sottogruppo rimasto in parità
// si riapplicano i criteri dall'inizio (con `riapplica: false` si prosegue invece dal criterio
// successivo, calcolando la classifica avulsa sul gruppo originario).
// Gli scontri non ancora disputati non contano: a inizio stagione si passa al criterio successivo,
// come fa il comitato nei comunicati.

export const PUNTI_VITTORIA = 3;
export const PUNTI_PAREGGIO = 1;

export function partitaConta(p) {
  return (p.stato === 'giocata' || p.stato === 'tavolino')
    && p.gol != null && Number.isInteger(p.gol.casa) && Number.isInteger(p.gol.ospite);
}

function statistiche(ids, partite) {
  const st = new Map(ids.map(id => [id, { squadra: id, punti: 0, giocate: 0, v: 0, n: 0, p: 0, rf: 0, rs: 0 }]));
  for (const pa of partite) {
    const c = st.get(pa.casa);
    const o = st.get(pa.ospite);
    if (!c || !o) continue;
    const gc = pa.gol.casa;
    const go = pa.gol.ospite;
    c.giocate++;
    o.giocate++;
    c.rf += gc;
    c.rs += go;
    o.rf += go;
    o.rs += gc;
    if (gc > go) {
      c.v++; o.p++; c.punti += PUNTI_VITTORIA;
    } else if (gc < go) {
      o.v++; c.p++; o.punti += PUNTI_VITTORIA;
    } else {
      c.n++; o.n++; c.punti += PUNTI_PAREGGIO; o.punti += PUNTI_PAREGGIO;
    }
  }
  return st;
}

function avulsa(gruppo, ctx) {
  const k = [...gruppo].sort().join('|');
  if (!ctx.avulse.has(k)) {
    const insieme = new Set(gruppo);
    const tra = ctx.valide.filter(p => insieme.has(p.casa) && insieme.has(p.ospite));
    ctx.avulse.set(k, statistiche(gruppo, tra));
  }
  return ctx.avulse.get(k);
}

// Ogni criterio restituisce un valore numerico: più alto è meglio.
const CRITERI = [
  {
    id: 'scontri',
    etichetta: n => (n === 2 ? 'Scontri diretti' : 'Classifica avulsa'),
    valore: (id, ctx, { avulsaSu }) => avulsa(avulsaSu, ctx).get(id).punti,
  },
  {
    id: 'scontri-dr',
    etichetta: n => (n === 2 ? 'Differenza reti negli scontri diretti' : 'Differenza reti nella classifica avulsa'),
    valore: (id, ctx, { avulsaSu }) => {
      const r = avulsa(avulsaSu, ctx).get(id);
      return r.rf - r.rs;
    },
  },
  { id: 'dr', etichetta: () => 'Differenza reti', valore: (id, ctx) => ctx.st.get(id).dr },
  { id: 'rf', etichetta: () => 'Reti realizzate', valore: (id, ctx) => ctx.st.get(id).rf },
  {
    id: 'fair-play',
    etichetta: () => 'Classifica Fair-Play',
    // Punteggio disciplinare: meno è meglio. Senza dati il criterio non decide.
    valore: (id, ctx) => (ctx.fairPlay ? -(ctx.fairPlay[id] ?? 0) : 0),
  },
  {
    id: 'sorteggio',
    etichetta: () => 'Sorteggio',
    valore: (id, ctx, { gruppo }) => {
      if (gruppo.some(x => !ctx.sorteggio.includes(x))) return 0;
      return -ctx.sorteggio.indexOf(id);
    },
  },
];

function risolvi(gruppo, avulsaSu, daCriterio, ctx) {
  if (gruppo.length === 1) return gruppo;
  for (let i = daCriterio; i < CRITERI.length; i++) {
    const criterio = CRITERI[i];
    const valori = new Map(gruppo.map(id => [id, criterio.valore(id, ctx, { gruppo, avulsaSu })]));
    const distinti = [...new Set(valori.values())].sort((a, b) => b - a);
    if (distinti.length === 1) continue;

    ctx.spareggi.push({ squadre: [...gruppo], criterio: criterio.id, etichetta: criterio.etichetta(avulsaSu.length) });
    return distinti.flatMap(v => {
      const sotto = gruppo.filter(id => valori.get(id) === v);
      if (sotto.length === 1) return sotto;
      return ctx.riapplica ? risolvi(sotto, sotto, 0, ctx) : risolvi(sotto, avulsaSu, i + 1, ctx);
    });
  }
  // Nessun criterio decide: ordine alfabetico provvisorio. È una parità da segnalare solo
  // se le squadre hanno già giocato (a inizio stagione sono tutte a zero).
  const ordinati = [...gruppo].sort((a, b) => ctx.nome(a).localeCompare(ctx.nome(b), 'it'));
  if (gruppo.some(id => ctx.st.get(id).giocate > 0)) ctx.irrisolte.push(ordinati);
  return ordinati;
}

/**
 * @param {object} o
 * @param {string[]} o.squadre       id delle squadre del girone
 * @param {object[]} o.partite       partite del girone (contano solo quelle giocate o a tavolino)
 * @param {object[]} [o.penalita]    { squadra, punti } punti da togliere
 * @param {object|null} [o.fairPlay] { idSquadra: punteggio disciplinare }, null se non disponibile
 * @param {string[]} [o.sorteggio]   ordine stabilito per sorteggio
 * @param {object} [o.nomi]          { idSquadra: nome } per l'ordine alfabetico delle parità
 */
export function calcolaClassifica({ squadre, partite, penalita = [], fairPlay = null, sorteggio = [], nomi = {}, riapplica = true }) {
  const valide = partite.filter(partitaConta);
  const st = statistiche(squadre, valide);
  for (const r of st.values()) r.penalita = 0;
  for (const pen of penalita) {
    const r = st.get(pen.squadra);
    if (r) r.penalita += pen.punti;
  }
  for (const r of st.values()) {
    r.punti -= r.penalita;
    r.dr = r.rf - r.rs;
  }

  const ctx = {
    st, valide, fairPlay, sorteggio, riapplica,
    avulse: new Map(), spareggi: [], irrisolte: [],
    nome: id => nomi[id] ?? id,
  };

  const perPunti = new Map();
  for (const r of st.values()) {
    if (!perPunti.has(r.punti)) perPunti.set(r.punti, []);
    perPunti.get(r.punti).push(r.squadra);
  }
  const ordine = [...perPunti.keys()].sort((a, b) => b - a)
    .flatMap(punti => risolvi(perPunti.get(punti), perPunti.get(punti), 0, ctx));

  return {
    righe: ordine.map((id, i) => ({ pos: i + 1, ...st.get(id) })),
    spareggi: ctx.spareggi,
    irrisolte: ctx.irrisolte,
  };
}
