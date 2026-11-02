// Normalizzazione dei testi e riconoscimento dei nomi di squadra scritti in modo impreciso
// (nei comunicati compaiono "ATELTICO MENTA", "BORUSSIA ROB UR", "OI BRIGANTI", ...).

export function normalizza(testo) {
  return String(testo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Chiave di confronto che ignora anche gli spazi: "BORUSSIA ROB UR" = "Borussia Robur".
export function chiave(testo) {
  return normalizza(testo).replace(/ /g, '');
}

export function slug(testo) {
  return normalizza(testo).replace(/ /g, '-');
}

// Distanza di Damerau-Levenshtein ristretta: lo scambio di due lettere vicine
// ("ATELTICO" / "ATLETICO") conta come un solo errore.
export function distanza(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => {
    const riga = new Array(n + 1).fill(0);
    riga[0] = i;
    return riga;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function nomiDi(squadra) {
  return [squadra.nome, ...(squadra.alias ?? [])];
}

/**
 * Cerca la squadra a cui si riferisce un testo.
 * Restituisce { squadra, tipo } con tipo 'esatta' | 'abbreviata' | 'simile', oppure null
 * se il testo non corrisponde a nessuna squadra o è ambiguo.
 */
export function trovaSquadra(testo, squadre) {
  const k = chiave(testo);
  if (!k) return null;

  for (const s of squadre) {
    if (nomiDi(s).some(n => chiave(n) === k)) return { squadra: s, tipo: 'esatta' };
  }

  // Nome abbreviato: "SIENNA UNITED", "WARRIOR", "Avis".
  if (k.length >= 4) {
    const candidate = squadre.filter(s => nomiDi(s).some(n => chiave(n).startsWith(k)));
    if (candidate.length === 1) return { squadra: candidate[0], tipo: 'abbreviata' };
  }

  // Refuso: accetta al massimo un errore ogni 5 lettere, purché la squadra più vicina sia unica.
  let migliore = null;
  let secondo = Infinity;
  for (const s of squadre) {
    const d = Math.min(...nomiDi(s).map(n => distanza(k, chiave(n))));
    if (!migliore || d < migliore.d) {
      if (migliore) secondo = migliore.d;
      migliore = { s, d };
    } else if (d < secondo) {
      secondo = d;
    }
  }
  const soglia = Math.max(1, Math.floor(k.length / 5));
  if (migliore && migliore.d <= soglia && secondo > migliore.d) {
    return { squadra: migliore.s, tipo: 'simile', distanza: migliore.d };
  }
  return null;
}
