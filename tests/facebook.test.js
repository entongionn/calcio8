import { test, uguale, vero } from './harness.js';
import { analizzaPost, applicaPost, leggiMarcatori, leggiPersone, leggiPost, validaPost } from '../app/js/facebook.js';
import { classificaMarcatori, golNonAttribuiti } from '../app/js/marcatori.js';
import { archivioDaSeed, migraArchivio, verificaArchivio } from '../app/js/archivio.js';
import { analizzaCalendario, applicaCalendario } from '../app/js/calendario.js';
import { STAGIONE_2026_27 } from '../app/js/seed.js';
import { CALENDARIO, POST_ARTICO_AVIS, POST_LORNANO_MONTERONI, POST_RIEPILOGO } from './fixtures/comunicati.js';

function conCalendario() {
  const base = archivioDaSeed(STAGIONE_2026_27);
  return applicaCalendario(base, analizzaCalendario(CALENDARIO, base).righe).archivio;
}
const messaggi = p => p.avvisi.filter(a => a.livello !== 'info').map(a => a.msg);

// --- Lettura del testo ---

test('legge il post Lornano – Monteroni', () => {
  const [p] = leggiPost(POST_LORNANO_MONTERONI);
  uguale([p.giornata, p.gironeIntestazione, p.casaTesto, p.ospiteTesto, p.gol], [1, 'B', 'Lornano', 'Monteroni', { casa: 1, ospite: 0 }]);
  uguale(p.marcatori.map(m => [m.nome, m.gol, m.squadraTesto]), [['Zapata Garces Cesar', 1, 'Lornano']]);
  uguale(p.ammoniti, [{ nome: 'Marruganti Mattia', squadraTesto: 'Lornano' }, { nome: 'Caushi Giulio', squadraTesto: 'Monteroni' }]);
  uguale([p.espulsi, p.arbitro, p.nonInterpretate], [[], 'Lorenzini Simone', []]);
});

test('legge il post Artico Senese – Avis Asta Taverne', () => {
  const [p] = leggiPost(POST_ARTICO_AVIS);
  uguale([p.giornata, p.gol], [1, { casa: 3, ospite: 2 }]);
  uguale(p.marcatori.map(m => [m.nome, m.gol, m.squadraTesto]), [
    ['Mazzoni Massimo', 1, 'Artico Senese'],
    ['Bindi Niccolò', 1, 'Artico Senese'],
    ['Chierici Lorenzo', 1, 'Artico Senese'],
    ['Abbate Giuseppe', 2, 'Avis Asta Taverne'],
  ]);
  uguale(p.ammoniti.map(x => [x.nome, x.squadraTesto]), [['Gigli Lorenzo', 'Artico Senese'], ['Natale Pasquale', 'Avis']]);
  uguale(p.espulsi.map(x => [x.nome, x.squadraTesto]), [['Chierici Alessandro', 'Artico Senese']]);
  uguale(p.arbitro, 'Vigni Filippo');
});

test('più post incollati insieme vengono separati', () => {
  const post = leggiPost(`${POST_LORNANO_MONTERONI}\n\n${POST_RIEPILOGO}\n\n${POST_ARTICO_AVIS}\nVedi meno`);
  uguale(post.map(p => (p.riepilogo ? 'riepilogo' : `${p.casaTesto}-${p.ospiteTesto}`)), ['Lornano-Monteroni', 'riepilogo', 'Artico Senese-Avis Asta Taverne']);
});

test('varianti nella scrittura dei marcatori', () => {
  const nomi = t => leggiMarcatori(t).map(m => [m.nome, m.gol, Boolean(m.autorete), Boolean(m.rigore)]);
  uguale(nomi('tripletta di Hodza Heldin, doppiette di Diana Giuseppe e Spada Alessandro, rete di Rossi Mario'), [
    ['Hodza Heldin', 3, false, false], ['Diana Giuseppe', 2, false, false], ['Spada Alessandro', 2, false, false], ['Rossi Mario', 1, false, false],
  ]);
  uguale(nomi('reti di Di Stefano Marco (2) e Verdi Luca su rigore'), [['Di Stefano Marco', 2, false, false], ['Verdi Luca', 1, false, true]]);
  uguale(nomi('autorete di Bianchi Paolo'), [['Bianchi Paolo', 1, true, false]]);
  uguale(nomi('rete del pareggio di Neri Carlo'), [['Neri Carlo', 1, false, false]]);
});

test('elenchi di persone: a capo, "nessuno", squadra mancante', () => {
  uguale(leggiPersone('nessuno'), []);
  uguale(leggiPersone('Rossi Mario (Ponte d\'Arbia), Bianchi Luca'), [{ nome: 'Rossi Mario', squadraTesto: 'Ponte d\'Arbia' }, { nome: 'Bianchi Luca', squadraTesto: null }]);
});

// --- Collegamento all'archivio ---

test('i due post reali sono importabili senza errori', () => {
  const a = conCalendario();
  const [l, ar] = analizzaPost(`${POST_LORNANO_MONTERONI}\n${POST_ARTICO_AVIS}`, a);
  uguale([l.id, l.esito, messaggi(l)], ['B:lornano:monteroni', 'nuovo', []]);
  uguale([ar.id, ar.esito, messaggi(ar)], ['B:artico-senese:avis-asta-taverne', 'nuovo', []]);
  uguale(ar.ammoniti[1].squadra, 'avis-asta-taverne', '«Avis» riconosciuta tra le due squadre');
});

test('salvataggio: risultato provvisorio, giocatori, marcatori', () => {
  let a = conCalendario();
  for (const p of analizzaPost(`${POST_LORNANO_MONTERONI}\n${POST_ARTICO_AVIS}`, a)) a = applicaPost(a, p);
  const p = a.partite.find(x => x.id === 'B:artico-senese:avis-asta-taverne');
  uguale([p.stato, p.gol, p.ufficiale, p.fonte, p.arbitro], ['giocata', { casa: 3, ospite: 2 }, false, 'facebook', 'Vigni Filippo']);
  uguale(p.eventi.nonAttribuiti, { casa: 0, ospite: 0 });
  uguale(a.giocatori.length, 10);
  uguale(verificaArchivio(a), []);

  const m = classificaMarcatori(a, ['artico-senese', 'avis-asta-taverne', 'lornano', 'monteroni']);
  uguale(m.map(r => [r.pos, r.nome, r.gol, r.provvisori]), [
    [1, 'Abbate Giuseppe', 2, 2],
    [2, 'Bindi Niccolò', 1, 1],
    [2, 'Chierici Lorenzo', 1, 1],
    [2, 'Mazzoni Massimo', 1, 1],
    [2, 'Zapata Garces Cesar', 1, 1],
  ]);
});

test('reimportare lo stesso post non cambia nulla', () => {
  let a = conCalendario();
  a = applicaPost(a, analizzaPost(POST_ARTICO_AVIS, a)[0]);
  const [p] = analizzaPost(POST_ARTICO_AVIS, a);
  uguale(p.esito, 'uguale');
  uguale(applicaPost(a, p), a);
});

test('grafia diversa dello stesso giocatore: riconosciuto e ricordato', () => {
  let a = conCalendario();
  a = applicaPost(a, analizzaPost('Borussia Robur - Sienna United Agrivigna 1-9\nPer la Sienna United tripletta di Hodza Heldin', a)[0]);
  const [p] = analizzaPost('Borussia Robur - Sienna United Agrivigna 1-9\nPer la Sienna United tripletta di Hodza Meldin', a);
  uguale(p.marcatori[0].giocatore, 'sienna-united-agrivigna:hodza-heldin');
  vero(p.avvisi.some(x => x.msg.includes('riconosciuto come Hodza Heldin')));
  uguale(p.esito, 'uguale');
});

test('gol senza marcatore: avviso e conteggio', () => {
  const a = conCalendario();
  const [p] = analizzaPost('Borussia Robur - Sienna United Agrivigna 1-9\nPer la Sienna United tripletta di Hodza Heldin, doppietta di Diana Giuseppe e rete di Spada Alessandro', a);
  uguale(p.esito, 'nuovo');
  uguale(p.nonAttribuiti, { casa: 1, ospite: 3 });
  vero(messaggi(p).includes('Sienna United Agrivigna: 3 gol senza marcatore'), messaggi(p).join(' | '));
  const salvato = applicaPost(a, p);
  uguale(golNonAttribuiti(salvato), 4);
});

test('squadre al contrario: la giornata del post indica l\'andata, non il ritorno', () => {
  const a = conCalendario();
  // Monteroni – Lornano esiste davvero: è la 6ª giornata (ritorno).
  const [p] = analizzaPost('1ª GIORNATA - GIRONE B\nMonteroni - Lornano 0-1\nPer il Lornano rete di Zapata Garces Cesar', a);
  uguale([p.id, p.gol, p.esito], ['B:lornano:monteroni', { casa: 1, ospite: 0 }, 'nuovo']);
  vero(messaggi(p).some(m => m.includes('invertiti')));

  const [ritorno] = analizzaPost('6ª GIORNATA - GIRONE B\nMonteroni - Lornano 0-1', a);
  uguale(ritorno.id, 'B:monteroni:lornano', 'il ritorno resta il ritorno');
});

test('squadre al contrario senza giornata: decide la data', () => {
  const a = conCalendario();
  const [p] = analizzaPost('Monteroni - Lornano 0-1', a, { oggi: '2026-11-03' });
  uguale(p.id, 'B:lornano:monteroni', 'il ritorno (30/11) non è ancora stato giocato');
  const [dopo] = analizzaPost('Monteroni - Lornano 0-1', a, { oggi: '2026-12-01' });
  uguale(dopo.id, 'B:monteroni:lornano');
});

test('un risultato ufficiale diverso non viene sovrascritto', () => {
  const a = conCalendario();
  Object.assign(a.partite.find(x => x.id === 'B:lornano:monteroni'), { stato: 'giocata', gol: { casa: 2, ospite: 0 }, ufficiale: true });
  const [p] = analizzaPost(POST_LORNANO_MONTERONI, a);
  uguale(p.esito, 'ufficiale');
  uguale(applicaPost(a, p), a);
});

test('un risultato ufficiale uguale resta ufficiale e riceve i marcatori', () => {
  const a = conCalendario();
  Object.assign(a.partite.find(x => x.id === 'B:lornano:monteroni'), { stato: 'giocata', gol: { casa: 1, ospite: 0 }, ufficiale: true, fonte: 'cuf' });
  const [p] = analizzaPost(POST_LORNANO_MONTERONI, a);
  uguale(p.esito, 'aggiorna');
  const x = applicaPost(a, p).partite.find(y => y.id === 'B:lornano:monteroni');
  uguale([x.ufficiale, x.fonte, x.eventi.marcatori.length], [true, 'cuf', 1]);
});

test('partita non in calendario o squadra sconosciuta: errore', () => {
  const vuoto = archivioDaSeed(STAGIONE_2026_27);
  uguale(analizzaPost(POST_LORNANO_MONTERONI, vuoto)[0].esito, 'errore');
  uguale(analizzaPost('Juventus - Lornano 1-0', conCalendario())[0].esito, 'errore');
});

test('il post di riepilogo viene riconosciuto e non importato', () => {
  const [p] = analizzaPost(POST_RIEPILOGO, conCalendario());
  uguale(p.esito, 'riepilogo');
});

test('modifica a mano in revisione: squadra di un marcatore', () => {
  const a = conCalendario();
  const [p] = analizzaPost('Lornano - Monteroni 1-0\nPer i padroni di casa rete di Zapata Garces Cesar', a);
  uguale(p.esito, 'errore');
  p.marcatori[0].squadraGol = 'lornano';
  p.marcatori[0].squadraManuale = true;
  validaPost(p, a);
  uguale(p.esito, 'nuovo');
});

// --- Formato dei dati ---

test('un archivio della versione 1 viene aggiornato senza perdere dati', () => {
  const v1 = conCalendario();
  delete v1.giocatori;
  v1.versioneSchema = 1;
  const v2 = migraArchivio(v1);
  uguale([v2.versioneSchema, v2.giocatori, v2.partite.length], [2, [], 75]);
  uguale(verificaArchivio(v2), []);
});
