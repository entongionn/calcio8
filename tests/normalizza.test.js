import { test, uguale } from './harness.js';
import { trovaSquadra, normalizza } from '../app/js/normalizza.js';
import { STAGIONE_2026_27 } from '../app/js/seed.js';

const squadre = STAGIONE_2026_27.squadre;
const id = testo => trovaSquadra(testo, squadre)?.squadra.id ?? null;

test('normalizza accenti, apostrofi tipografici e maiuscole', () => {
  uguale(normalizza('PONTE D’ARBIA'), 'ponte d arbia');
  uguale(normalizza('Bindi Niccolò'), 'bindi niccolo');
});

test('riconosce i nomi scritti correttamente', () => {
  uguale(id('SPORTING UOPINI'), 'sporting-uopini');
  uguale(id('SANT’ANDREA'), 'sant-andrea');
  uguale(id("Ponte d'Arbia"), 'ponte-d-arbia');
});

test('riconosce i nomi storpiati dei comunicati', () => {
  uguale(id('ATELTICO MENTA'), 'atletico-menta');
  uguale(id('SPORTIMG UOPINI'), 'sporting-uopini');
  uguale(id('BORUSSIA ROB UR'), 'borussia-robur');
  uguale(id('OI BRIGANTI'), 'i-briganti');
  uguale(id('CASTELLINA IN CHNIANTI'), 'castellina-in-chianti');
  uguale(id('SIENNA UNITE AGRIVIGNA'), 'sienna-united-agrivigna');
  uguale(id('Sienn a United Agrivigna'), 'sienna-united-agrivigna');
});

test('riconosce abbreviazioni e alias', () => {
  uguale(id('WARRIOR'), 'warriors');
  uguale(id('SIENNA UNITED'), 'sienna-united-agrivigna');
  uguale(id('Avis'), 'avis-asta-taverne');
  uguale(id('S. Andrea'), 'sant-andrea');
  uguale(id('AVIS ASTA Taverne'), 'avis-asta-taverne');
});

test('non inventa corrispondenze per nomi sconosciuti', () => {
  uguale(id('Juventus'), null);
  uguale(id('Over'), null);
  uguale(id(''), null);
});
