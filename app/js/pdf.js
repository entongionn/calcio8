// Lettura del testo dei PDF dei Comunicati Ufficiali con pdf.js (Mozilla, Apache 2.0),
// incluso in vendor/pdfjs. La libreria (circa 1,8 MB) viene caricata solo quando serve.

// Frammenti con altezza diversa di meno di così (in punti PDF) stanno sulla stessa riga.
const TOLLERANZA_RIGA = 2;

let libreria = null;

async function caricaLibreria() {
  if (!libreria) {
    const pdfjs = await import('../vendor/pdfjs/pdf.min.js');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
    libreria = pdfjs;
  }
  return libreria;
}

// Spazio vuoto tra due frammenti, in proporzione alla dimensione del carattere, oltre il quale
// si considerano parole separate.
const SPAZIO_MINIMO = 0.2;

// Unisce i frammenti di una riga da sinistra a destra. Alcuni PDF (es. il CUF 1) spezzano le
// parole in pezzi attaccati ("2" "6" ".1" "0" per "26.10"): si aggiunge uno spazio solo dove
// il PDF ne ha uno o dove c'è un vuoto visibile tra un frammento e il successivo.
function unisciRiga(pezzi) {
  let testo = '';
  let fine = -Infinity;
  let spazio = false;
  for (const p of pezzi.sort((a, b) => a.x - b.x)) {
    if (!p.testo.trim()) {
      spazio = true;
      continue;
    }
    const vuoto = p.x - fine > SPAZIO_MINIMO * p.altezza;
    if (testo && (spazio || vuoto || /^\s/.test(p.testo))) testo += ' ';
    testo += p.testo.trim();
    fine = p.larghezza ? p.x + p.larghezza : -Infinity;
    spazio = /\s$/.test(p.testo);
  }
  return testo.replace(/\s+/g, ' ');
}

/**
 * Ricompone le righe di una pagina dai frammenti di testo restituiti da pdf.js:
 * i frammenti alla stessa altezza formano una riga, letti da sinistra a destra.
 * Così ogni riga della tabella del calendario diventa "Lun 02.11.2026 20.30 Petriccio CASA vs OSPITE C".
 */
export function righeDaFrammenti(frammenti) {
  const pezzi = frammenti
    .filter(f => f.str)
    .map(f => ({
      testo: f.str,
      x: f.transform[4],
      y: f.transform[5],
      larghezza: f.width ?? 0,
      altezza: Math.abs(f.transform[3]) || f.height || 10,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const righe = [];
  for (const p of pezzi) {
    const ultima = righe[righe.length - 1];
    if (ultima && Math.abs(ultima.y - p.y) <= TOLLERANZA_RIGA) ultima.pezzi.push(p);
    else righe.push({ y: p.y, pezzi: [p] });
  }
  return righe.map(r => unisciRiga(r.pezzi)).filter(Boolean);
}

/** Estrae il testo di tutto il PDF, una riga per riga di testo. */
export async function testoDaPdf(file, { suAvanzamento } = {}) {
  const pdfjs = await caricaLibreria();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const righe = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      righe.push(...righeDaFrammenti((await pagina.getTextContent()).items));
      pagina.cleanup();
      suAvanzamento?.(n, doc.numPages);
    }
    return { testo: righe.join('\n'), pagine: doc.numPages };
  } finally {
    await doc.destroy();
  }
}
