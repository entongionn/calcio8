import { test, uguale } from './harness.js';
import { archivioDaSeed, confrontaArchivi, unisciArchivi, verificaArchivio } from '../app/js/archivio.js';
import { applicaCalendario, analizzaCalendario } from '../app/js/calendario.js';
import { STAGIONE_2026_27 } from '../app/js/seed.js';
import { CALENDARIO } from './fixtures/comunicati.js';

function conCalendario() {
  const base = archivioDaSeed(STAGIONE_2026_27);
  return applicaCalendario(base, analizzaCalendario(CALENDARIO, base).righe).archivio;
}

test('un archivio appena creato è un backup valido', () => {
  uguale(verificaArchivio(conCalendario()), []);
});

test('rifiuta file che non sono backup dell\'app', () => {
  uguale(verificaArchivio({ ciao: 1 }).length > 0, true);
  uguale(verificaArchivio(null), ['Il file non contiene un oggetto JSON.']);
  const futuro = { ...conCalendario(), versioneSchema: 99 };
  uguale(verificaArchivio(futuro).length, 1);
});

test('confronto: stesso archivio → tutto uguale, nessun duplicato', () => {
  const a = conCalendario();
  const c = confrontaArchivi(a, structuredClone(a));
  uguale([c.collezioni.partite.nuovi, c.collezioni.partite.uguali, c.collezioni.partite.diversi.length], [0, 75, 0]);
  const u = unisciArchivi(a, structuredClone(a));
  uguale(u.partite.length, 75);
});

test('unione: differenze risolte secondo la priorità scelta', () => {
  const mio = conCalendario();
  const altro = structuredClone(mio);
  const id = 'B:lornano:monteroni';
  altro.partite.find(p => p.id === id).gol = { casa: 1, ospite: 0 };
  altro.partite.find(p => p.id === id).stato = 'giocata';
  altro.penalita.push({ id: 'pen-1', squadra: 'monteroni', girone: 'B', punti: 1, motivo: 'prova' });
  mio.partite.pop();

  const c = confrontaArchivi(mio, altro);
  uguale([c.collezioni.partite.nuovi, c.collezioni.partite.diversi.length, c.collezioni.penalita.nuovi], [1, 1, 1]);

  const vinceAltro = unisciArchivi(mio, altro, 'altro');
  uguale(vinceAltro.partite.length, 75);
  uguale(vinceAltro.partite.find(p => p.id === id).gol, { casa: 1, ospite: 0 });

  const vinceMio = unisciArchivi(mio, altro, 'mio');
  uguale(vinceMio.partite.find(p => p.id === id).gol, null);
  uguale(vinceMio.penalita.length, 1, 'i record nuovi entrano comunque');
});

test('segnala un backup di un\'altra stagione', () => {
  const mio = conCalendario();
  const altro = { ...structuredClone(mio), stagione: { id: '2027-28', nome: 'altra' } };
  uguale(confrontaArchivi(mio, altro).stagioneDiversa, true);
});
