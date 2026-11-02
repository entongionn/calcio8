import { test, uguale, vero } from './harness.js';
import { calcolaClassifica } from '../app/js/classifica.js';
import { STAGIONE_2026_27 } from '../app/js/seed.js';
import { RISULTATI_G1 } from './fixtures/comunicati.js';

const girone = id => STAGIONE_2026_27.gironi.find(g => g.id === id).squadre;
const nomi = Object.fromEntries(STAGIONE_2026_27.squadre.map(s => [s.id, s.nome]));
const partita = (g, casa, ospite, gc, go, extra = {}) => ({
  id: `${g}:${casa}:${ospite}`, girone: g, casa, ospite, stato: 'giocata', gol: { casa: gc, ospite: go }, ...extra,
});
const g1 = id => RISULTATI_G1.filter(r => r[0] === id).map(r => partita(...r));
const riga = r => [r.squadra, r.punti, r.giocate, r.v, r.n, r.p, r.rf, r.rs, r.dr];
const ordine = c => c.righe.map(r => r.squadra);

// --- Dati reali: 1ª giornata, CUF 2 ---

test('girone A dopo la 1ª giornata: identico al CUF 2', () => {
  const c = calcolaClassifica({ squadre: girone('A'), partite: g1('A'), nomi });
  uguale(c.righe.map(riga), [
    ['terre-di-siena', 3, 1, 1, 0, 0, 7, 1, 6],
    ['sporting-uopini', 3, 1, 1, 0, 0, 5, 1, 4],
    ['i-briganti', 3, 1, 1, 0, 0, 2, 0, 2],
    ['sant-andrea', 0, 0, 0, 0, 0, 0, 0, 0],
    ['old-boys', 0, 1, 0, 0, 1, 0, 2, -2],
    ['castellina-in-chianti', 0, 1, 0, 0, 1, 1, 5, -4],
    ['agriarte', 0, 1, 0, 0, 1, 1, 7, -6],
  ]);
  uguale(c.irrisolte, []);
  vero(c.spareggi.some(s => s.criterio === 'dr' && s.squadre.length === 3), 'tre squadre a 3 punti decise dalla differenza reti');
});

test('girone B: Avis davanti a Monteroni per reti realizzate (il CUF 2 li inverte)', () => {
  const c = calcolaClassifica({ squadre: girone('B'), partite: g1('B'), nomi });
  uguale(ordine(c), ['sienna-united-agrivigna', 'artico-senese', 'lornano', 'avis-asta-taverne', 'monteroni', 'borussia-robur']);
  const s = c.spareggi.find(x => x.squadre.length === 2 && x.squadre.includes('avis-asta-taverne'));
  uguale(s.criterio, 'rf');
});

test('girone C: Sienterina e Vico Alto restano in parità senza dati Fair-Play', () => {
  const c = calcolaClassifica({ squadre: girone('C'), partite: g1('C'), nomi });
  uguale(ordine(c), ['ponte-d-arbia', 'atletico-menta', 'sienterina', 'vico-alto', 'road-to-murlo', 'warriors']);
  uguale(c.irrisolte, [['sienterina', 'vico-alto']]);
});

test('girone C: con il Fair-Play (2 ammoniti Vico Alto) passa avanti Sienterina', () => {
  const c = calcolaClassifica({ squadre: girone('C'), partite: g1('C'), nomi, fairPlay: { 'vico-alto': 2 } });
  uguale(c.irrisolte, []);
  uguale(c.righe[2].squadra, 'sienterina');
  uguale(c.spareggi.find(x => x.squadre.includes('vico-alto')).criterio, 'fair-play');
});

test('il sorteggio risolve la parità quando gli altri criteri non bastano', () => {
  const c = calcolaClassifica({ squadre: girone('C'), partite: g1('C'), nomi, sorteggio: ['vico-alto', 'sienterina'] });
  uguale(c.irrisolte, []);
  uguale([c.righe[2].squadra, c.righe[3].squadra], ['vico-alto', 'sienterina']);
});

// --- Casi costruiti a mano ---

test('due squadre: lo scontro diretto vale più della differenza reti', () => {
  const partite = [
    partita('X', 'a', 'b', 1, 0),
    partita('X', 'b', 'y', 9, 0),
    partita('X', 'a', 'z', 0, 0),
    partita('X', 'b', 'z', 0, 0),
  ];
  // a e b a 4 punti; b ha DR +8, a solo +1, ma a ha vinto lo scontro diretto.
  const c = calcolaClassifica({ squadre: ['a', 'b', 'y', 'z'], partite });
  uguale(ordine(c).slice(0, 2), ['a', 'b']);
  uguale(c.spareggi[0].criterio, 'scontri');
  uguale(c.spareggi[0].etichetta, 'Scontri diretti');
});

test('tre squadre: decide la differenza reti nella classifica avulsa', () => {
  // Giro di vittorie: classifica avulsa a 3 punti ciascuna. DR avulsa: a +2, c 0, b -2.
  const partite = [
    partita('X', 'a', 'b', 3, 0),
    partita('X', 'b', 'c', 1, 0),
    partita('X', 'c', 'a', 1, 0),
  ];
  const c = calcolaClassifica({ squadre: ['a', 'b', 'c'], partite });
  uguale(ordine(c), ['a', 'c', 'b']);
  uguale(c.spareggi[0].criterio, 'scontri-dr');
  uguale(c.spareggi[0].etichetta, 'Differenza reti nella classifica avulsa');
});

// a, b, c a 7 punti. Classifica avulsa: b 4, c 4, a 0 → a ultima delle tre.
// b e c hanno pareggiato tra loro; b ha DR generale +10, c +6; nella classifica avulsa
// a tre però c ha DR +5 e b +1.
const partiteSottogruppo = [
  partita('X', 'b', 'a', 1, 0),
  partita('X', 'c', 'a', 5, 0),
  partita('X', 'b', 'c', 2, 2),
  partita('X', 'b', 'w', 9, 0),
  partita('X', 'c', 'w', 1, 0),
  partita('X', 'a', 'z', 1, 0),
  partita('X', 'a', 'w', 1, 0),
  partita('X', 'z', 'a', 0, 0),
];

test('sottogruppo in parità: si riparte dagli scontri diretti tra le due rimaste', () => {
  const c = calcolaClassifica({ squadre: ['a', 'b', 'c', 'z', 'w'], partite: partiteSottogruppo });
  uguale(c.righe.slice(0, 3).map(r => r.punti), [7, 7, 7]);
  // b-c: scontro diretto pari, DR scontro diretto pari → differenza reti generale: b +10, c +6.
  uguale(ordine(c).slice(0, 3), ['b', 'c', 'a']);
  const sotto = c.spareggi.find(s => s.squadre.length === 2);
  uguale(sotto.criterio, 'dr');
});

test('con riapplica: false si prosegue con la DR della classifica avulsa a tre', () => {
  const c = calcolaClassifica({ squadre: ['a', 'b', 'c', 'z', 'w'], partite: partiteSottogruppo, riapplica: false });
  uguale(ordine(c).slice(0, 3), ['c', 'b', 'a']);
});

test('penalizzazioni, gare a tavolino e gare annullate', () => {
  const partite = [
    partita('X', 'a', 'b', 3, 0, { stato: 'tavolino' }),
    partita('X', 'b', 'c', 2, 1, { stato: 'annullata' }),
    { id: 'X:c:a', girone: 'X', casa: 'c', ospite: 'a', stato: 'programmata', gol: null },
  ];
  const c = calcolaClassifica({ squadre: ['a', 'b', 'c'], partite, penalita: [{ squadra: 'b', punti: 1 }] });
  uguale(c.righe.map(riga), [
    ['a', 3, 1, 1, 0, 0, 3, 0, 3],
    ['c', 0, 0, 0, 0, 0, 0, 0, 0],
    ['b', -1, 1, 0, 0, 1, 0, 3, -3],
  ]);
  uguale(c.righe[2].penalita, 1);
});

test('a inizio stagione nessuna parità viene segnalata', () => {
  const c = calcolaClassifica({ squadre: girone('A'), partite: [], nomi });
  uguale(c.irrisolte, []);
  uguale(ordine(c)[0], 'agriarte', 'ordine alfabetico provvisorio');
});
