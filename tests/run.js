// Esecuzione dei test da riga di comando: node tests/run.js
import './tutti.js';
import { esegui } from './harness.js';

const esiti = await esegui();
for (const e of esiti) {
  console.log(`${e.ok ? 'ok  ' : 'FAIL'}  ${e.nome}`);
  if (!e.ok) console.log(`      ${e.errore.replace(/\n/g, '\n      ')}`);
}
const falliti = esiti.filter(e => !e.ok).length;
console.log(`\n${esiti.length - falliti}/${esiti.length} test superati`);
process.exitCode = falliti ? 1 : 0;
