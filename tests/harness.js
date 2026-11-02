// Mini libreria di test senza dipendenze: funziona sia in Node sia nel browser.

const casi = [];

export function test(nome, fn) {
  casi.push({ nome, fn });
}

export function uguale(ottenuto, atteso, messaggio = 'Valori diversi') {
  const a = JSON.stringify(ottenuto);
  const b = JSON.stringify(atteso);
  if (a !== b) throw new Error(`${messaggio}\n    atteso:   ${b}\n    ottenuto: ${a}`);
}

export function vero(condizione, messaggio = 'Condizione non verificata') {
  if (!condizione) throw new Error(messaggio);
}

export async function esegui() {
  const esiti = [];
  for (const { nome, fn } of casi) {
    try {
      await fn();
      esiti.push({ nome, ok: true });
    } catch (e) {
      esiti.push({ nome, ok: false, errore: e.message });
    }
  }
  return esiti;
}
