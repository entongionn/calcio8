import { test, uguale, vero } from './harness.js';
import { analizzaCalendario, applicaCalendario, separaRighe, validaCalendario } from '../app/js/calendario.js';
import { archivioDaSeed } from '../app/js/archivio.js';
import { STAGIONE_2026_27 } from '../app/js/seed.js';
import { CALENDARIO } from './fixtures/comunicati.js';

const nuovoArchivio = () => archivioDaSeed(STAGIONE_2026_27);
const trova = (analisi, casa, ospite) => analisi.righe.find(r => r.casa === casa && r.ospite === ospite);
const messaggi = r => r.avvisi.map(a => a.msg).join(' | ');

test('legge tutte le 75 partite del calendario fino a Natale', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  uguale(a.righe.length, 75);
  uguale(a.nonRiconosciute.length, 0);
  uguale(a.righe.filter(r => r.esito === 'errore').length, 0, 'nessuna riga in errore');
  uguale(a.righe.filter(r => r.esito === 'nuova').length, 75);
});

test('ricava data, ora, campo e giornata', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  const r = trova(a, 'road-to-murlo', 'atletico-menta');
  uguale([r.data, r.ora, r.campo, r.girone, r.giornata], ['2026-10-26', '21:40', 'Petriccio', 'C', 1]);
  const m = trova(a, 'monteroni', 'avis-asta-taverne');
  uguale([m.campo, m.casa, m.giornata], ['Monteroni', 'monteroni', 3], 'campo e squadra con lo stesso nome');
});

test('il girone si ricava dalle squadre, non dalla colonna sbagliata', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  const r = trova(a, 'vico-alto', 'road-to-murlo');
  uguale([r.gironeColonna, r.girone], ['A', 'C']);
  vero(messaggi(r).includes('indica il girone A'), 'segnala la differenza');
  const sbagliate = a.righe.filter(x => x.gironeColonna && x.gironeColonna !== x.girone);
  uguale(sbagliate.length, 12);
});

test('ogni girone ha il numero giusto di partite per giornata', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  const conta = (g, n) => a.righe.filter(r => r.girone === g && r.giornata === n).length;
  for (let n = 1; n <= 8; n++) uguale(conta('A', n), 3, `girone A giornata ${n}`);
  uguale(conta('A', 9), 3, 'girone A giornata 9');
  for (let n = 1; n <= 8; n++) uguale(conta('B', n), 3, `girone B giornata ${n}`);
  uguale(conta('C', 7), 2, 'nel comunicato la 7ª del girone C ha solo 2 partite');
  uguale(conta('C', 8), 4, 'e la 8ª ne ha 4, contando il "recupero"');
});

test('il "recupero ottava giornata" del girone C viene ricondotto alla 7ª', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  const r = trova(a, 'road-to-murlo', 'warriors');
  uguale([r.giornata, r.recupero, r.suggerimento], [8, true, 7]);
  vero(messaggi(r).includes('due volte'), messaggi(r));

  r.giornata = r.suggerimento;
  r.giornataModificata = true;
  validaCalendario(a, nuovoArchivio());
  uguale(r.avvisi.filter(x => x.livello !== 'info').length, 0, messaggi(r));
});

test('una giornata corretta resta corretta quando si reimporta il comunicato', () => {
  const base = nuovoArchivio();
  const prima = analizzaCalendario(CALENDARIO, base);
  const r = trova(prima, 'road-to-murlo', 'warriors');
  r.giornata = r.suggerimento;
  r.giornataModificata = true;
  validaCalendario(prima, base);
  const archivio = applicaCalendario(base, prima.righe).archivio;
  uguale(archivio.partite.find(p => p.id === 'C:road-to-murlo:warriors').giornataCorretta, true);

  const dopo = analizzaCalendario(CALENDARIO, archivio);
  const r2 = trova(dopo, 'road-to-murlo', 'warriors');
  uguale([r2.giornata, r2.esito], [7, 'invariata']);
  uguale(dopo.righe.filter(x => x.esito !== 'invariata').length, 0);
});

test('segnala la data fuori posto dell\'ottava giornata', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  const r = trova(a, 'lornano', 'sienna-united-agrivigna');
  uguale(r.data, '2026-12-04');
  vero(messaggi(r).includes('precedente'), messaggi(r));
  const ereditata = trova(a, 'i-briganti', 'old-boys');
  vero(messaggi(ereditata).includes('precedente'), 'anche la riga che eredita la data');
});

test('i riposi dichiarati sono coerenti con le partite', () => {
  const a = analizzaCalendario(CALENDARIO, nuovoArchivio());
  uguale(a.riposi.length, 9);
  uguale(a.avvisiGenerali.length, 0, a.avvisiGenerali.map(x => x.msg).join(' | '));
});

test('la seconda importazione non duplica e non tocca i risultati', () => {
  const base = nuovoArchivio();
  const primo = applicaCalendario(base, analizzaCalendario(CALENDARIO, base).righe);
  uguale(primo.aggiunte, 75);
  const p = primo.archivio.partite.find(x => x.id === 'A:sporting-uopini:castellina-in-chianti');
  Object.assign(p, { stato: 'giocata', gol: { casa: 5, ospite: 1 } });

  const analisi = analizzaCalendario(CALENDARIO, primo.archivio);
  uguale(analisi.righe.filter(r => r.esito === 'invariata').length, 75);
  const secondo = applicaCalendario(primo.archivio, analisi.righe);
  uguale([secondo.aggiunte, secondo.aggiornate, secondo.archivio.partite.length], [0, 0, 75]);
  uguale(secondo.archivio.partite.find(x => x.id === p.id).gol, { casa: 5, ospite: 1 });
});

test('un cambio di data viene riconosciuto come modifica', () => {
  const base = nuovoArchivio();
  const primo = applicaCalendario(base, analizzaCalendario(CALENDARIO, base).righe).archivio;
  const spostato = CALENDARIO.replace('Ven 30.10.2026 20.30 Petriccio LORNANO', 'Sab 31.10.2026 14.30 Petriccio LORNANO');
  const a = analizzaCalendario(spostato, primo);
  const r = trova(a, 'lornano', 'monteroni');
  uguale(r.esito, 'modificata');
  uguale(r.differenze.map(d => d.campo), ['data', 'ora']);
});

test('testo copiato dal PDF tutto su una riga: stesso risultato', () => {
  // Come arriva copiando dal PDF: niente a capo, spazi doppi qua e là.
  const dallaSeconda = CALENDARIO.slice(CALENDARIO.indexOf('CALENDARIO GIRONE A-B-C\nSECONDA'));
  const suUnaRiga = dallaSeconda.replace(/\n(\d{2}\.\d{2} )/g, '  $1').replace(/\n/g, ' ');
  vero(!suUnaRiga.includes('\n'));
  const a = analizzaCalendario(suUnaRiga, nuovoArchivio());
  uguale(a.righe.length, 66);
  uguale(a.nonRiconosciute.length, 0);
  uguale(a.riposi.length, 8);
  uguale(a.avvisiGenerali.length, 0);
  uguale(a.righe.filter(r => r.esito === 'errore').length, 0);

  const atteso = analizzaCalendario(dallaSeconda, nuovoArchivio());
  const chiave = r => [r.id, r.giornata, r.data, r.ora, r.campo, r.recupero, r.suggerimento];
  uguale(a.righe.map(chiave), atteso.righe.map(chiave));
  const ultima = trova(a, 'road-to-murlo', 'warriors');
  uguale([ultima.giornata, ultima.suggerimento, ultima.data], [8, 7, '2026-12-21']);
});

test('separaRighe non tocca un testo già diviso in righe', () => {
  uguale(separaRighe(CALENDARIO), CALENDARIO);
});

test('riga con squadra sconosciuta: errore, le altre restano importabili', () => {
  const a = analizzaCalendario('PRIMA GIORNATA\nLun 26.10.2026 20.30 Petriccio JUVENTUS vs AGRIARTE A\n21.40 Petriccio TERRE DI SIENA vs AGRIARTE A', nuovoArchivio());
  uguale(a.righe.map(r => r.esito), ['errore', 'nuova']);
});
