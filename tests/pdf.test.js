import { test, uguale } from './harness.js';
import { righeDaFrammenti } from '../app/js/pdf.js';

// Frammento come lo restituisce pdf.js: testo e posizione (transform[4] = x, transform[5] = y).
const f = (str, x, y) => ({ str, transform: [10, 0, 0, 10, x, y] });

test('ricompone le righe della tabella del calendario come nel CUF 2', () => {
  // Coordinate reali della pagina 7 del CUF 2 (errata corrige).
  const frammenti = [
    f('CALENDARIO GIRONE A-B-C', 157.5, 711.4),
    f('', 157.5, 711.4),
    f('SECONDA GIORNATA', 192.9, 687.4),
    f('Lun 02.11.2026', 64.1, 661.8),
    f(' ', 127.3, 661.8),
    f('20.30', 141.1, 661.8),
    f('Petriccio', 186.3, 661.8),
    f('C', 513.9, 661.8),
    f('WARRIORS vs ROAD TO MURLO', 293.1, 661.8),
    f('21.40', 141.1, 649.5),
    f('A', 513.6, 649.5),
    f('Petriccio', 186.3, 649.5),
    f('I BRIGANTI vs TERRE DI SIENA', 295.2, 649.5),
  ];
  uguale(righeDaFrammenti(frammenti), [
    'CALENDARIO GIRONE A-B-C',
    'SECONDA GIORNATA',
    'Lun 02.11.2026 20.30 Petriccio WARRIORS vs ROAD TO MURLO C',
    '21.40 Petriccio I BRIGANTI vs TERRE DI SIENA A',
  ]);
});

test('CUF 1: parole spezzate in frammenti attaccati vengono ricomposte', () => {
  // Coordinate reali della pagina 15 del CUF 1: la data arriva in sei pezzi.
  const g = (str, x, width) => ({ str, width, transform: [10, 0, 0, 10, x, 657.5] });
  const frammenti = [
    g('Lun', 64.1, 16.1), g(' ', 80.2, 2.6), g('2', 82.8, 5.0), g('6', 87.7, 5.0), g('.1', 92.8, 7.5),
    g('0', 100.3, 5.0), g('.202', 105.3, 17.4), g('6', 122.8, 5.0), g(' ', 127.8, 13.3),
    g('20.30', 141.0, 22.6), g(' ', 163.6, 22.9), g('Monter', 186.5, 28.0), g('oni', 214.5, 13.0),
    g(' ', 227.5, 31.0), g('SPORTING UOPINI vs CASTELLINA IN CHIANTI', 258.5, 217.3), g(' ', 475.8, 38.0), g('A', 513.8, 7.2),
  ];
  uguale(righeDaFrammenti(frammenti), ['Lun 26.10.2026 20.30 Monteroni SPORTING UOPINI vs CASTELLINA IN CHIANTI A']);
});

test('frammenti staccati senza spazio esplicito restano parole separate', () => {
  const g = (str, x, width) => ({ str, width, transform: [10, 0, 0, 10, x, 100] });
  uguale(righeDaFrammenti([g('GIRONE A', 297.8, 100.5), g('-', 398.2, 6.7), g('B', 404.9, 13.4), g('Petriccio', 450, 35)]), ['GIRONE A-B Petriccio']);
});

test('frammenti quasi alla stessa altezza finiscono sulla stessa riga', () => {
  uguale(righeDaFrammenti([f('B', 50, 100.8), f('A', 10, 100), f('C', 10, 90)]), ['A B', 'C']);
});
