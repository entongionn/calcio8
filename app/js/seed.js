// Dati di base della stagione 2026-2027, presi dal Comunicato Ufficiale n.1 e
// dall'errata corrige del n.2 (I Briganti al posto di Over nel girone 3 di Coppa).

const squadra = (id, nome, alias = []) => ({ id, nome, alias });

export const STAGIONE_2026_27 = {
  stagione: { id: '2026-27', nome: 'Stagione 2026–2027 · Calcio a 8' },
  campi: ['Petriccio', 'San Miniato', 'Monteroni'],
  squadre: [
    squadra('sporting-uopini', 'Sporting Uopini'),
    squadra('castellina-in-chianti', 'Castellina in Chianti'),
    squadra('sant-andrea', "Sant'Andrea", ['S. Andrea', 'S.Andrea']),
    squadra('terre-di-siena', 'Terre di Siena'),
    squadra('i-briganti', 'I Briganti'),
    squadra('old-boys', 'Old Boys'),
    squadra('agriarte', 'Agriarte'),
    squadra('avis-asta-taverne', 'Avis Asta Taverne', ['Avis']),
    squadra('monteroni', 'Monteroni'),
    squadra('borussia-robur', 'Borussia Robur'),
    squadra('artico-senese', 'Artico Senese'),
    squadra('lornano', 'Lornano'),
    squadra('sienna-united-agrivigna', 'Sienna United Agrivigna', ['Sienna United']),
    squadra('atletico-menta', 'Atletico Menta'),
    squadra('ponte-d-arbia', "Ponte d'Arbia"),
    squadra('vico-alto', 'Vico Alto'),
    squadra('road-to-murlo', 'Road to Murlo'),
    squadra('warriors', 'Warriors', ['Warrior']),
    squadra('sienterina', 'Sienterina'),
  ],
  competizioni: [
    { id: 'campionato', nome: 'Campionato provinciale' },
    { id: 'coppa', nome: 'Coppa AICS' },
  ],
  gironi: [
    {
      id: 'A', competizione: 'campionato', fase: 'fase1', nome: 'Girone A', formula: 'andata-ritorno',
      squadre: ['sporting-uopini', 'castellina-in-chianti', 'sant-andrea', 'terre-di-siena', 'i-briganti', 'old-boys', 'agriarte'],
    },
    {
      id: 'B', competizione: 'campionato', fase: 'fase1', nome: 'Girone B', formula: 'andata-ritorno',
      squadre: ['avis-asta-taverne', 'monteroni', 'borussia-robur', 'artico-senese', 'lornano', 'sienna-united-agrivigna'],
    },
    {
      id: 'C', competizione: 'campionato', fase: 'fase1', nome: 'Girone C', formula: 'andata-ritorno',
      squadre: ['atletico-menta', 'ponte-d-arbia', 'vico-alto', 'road-to-murlo', 'warriors', 'sienterina'],
    },
    { id: 'coppa-1', competizione: 'coppa', fase: 'gironi', nome: 'Girone 1', formula: 'andata', squadre: ['avis-asta-taverne', 'warriors', 'old-boys'] },
    { id: 'coppa-2', competizione: 'coppa', fase: 'gironi', nome: 'Girone 2', formula: 'andata', squadre: ['agriarte', 'terre-di-siena', 'borussia-robur', 'sant-andrea'] },
    { id: 'coppa-3', competizione: 'coppa', fase: 'gironi', nome: 'Girone 3', formula: 'andata', squadre: ['i-briganti', 'sporting-uopini', 'lornano'] },
    { id: 'coppa-4', competizione: 'coppa', fase: 'gironi', nome: 'Girone 4', formula: 'andata', squadre: ['castellina-in-chianti', 'artico-senese', 'vico-alto'] },
    { id: 'coppa-5', competizione: 'coppa', fase: 'gironi', nome: 'Girone 5', formula: 'andata', squadre: ['atletico-menta', 'road-to-murlo', 'ponte-d-arbia'] },
    { id: 'coppa-6', competizione: 'coppa', fase: 'gironi', nome: 'Girone 6', formula: 'andata', squadre: ['sienterina', 'monteroni', 'sienna-united-agrivigna'] },
  ],
};
