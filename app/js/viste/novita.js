// Novità: ricavate dai dati (risultati più recenti, rinvii, prossima giornata), senza un elenco a parte.
import * as stato from '../stato.js';
import { partitaConta } from '../classifica.js';
import { esc, formattaData, formattaDataOra } from '../util.js';
import { nomeSquadra, rigaPartita, testata, vistaBenvenuto } from './comuni.js';

export function vistaNovita(el) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  const campionato = a.partite.filter(p => p.competizione === 'campionato');
  const risultati = campionato.filter(partitaConta)
    .sort((x, y) => `${y.data}${y.ora}`.localeCompare(`${x.data}${x.ora}`))
    .slice(0, 8);
  const rinviate = campionato.filter(p => p.stato === 'rinviata');
  const provvisori = campionato.filter(p => partitaConta(p) && !p.ufficiale).length;

  el.innerHTML = `
    ${testata('Novità')}
    <section class="scheda">
      <p><strong>Dati aggiornati il ${esc(formattaDataOra(a.aggiornato))}</strong></p>
      <p class="nota">
        ${provvisori ? `${provvisori} risultat${provvisori === 1 ? 'o è provvisorio' : 'i sono provvisori'}: vengono dai post Facebook del comitato e diventano ufficiali con il Comunicato.` : 'Tutti i risultati sono confermati dai Comunicati Ufficiali.'}
      </p>
    </section>
    ${rinviate.length ? `
      <section class="scheda">
        <h2>Partite rinviate</h2>
        <ul class="elenco">${rinviate.map(p => `<li><span>${esc(nomeSquadra(a, p.casa))} – ${esc(nomeSquadra(a, p.ospite))}</span><span class="nota">${p.giornata}ª giornata${p.data ? ` · ${esc(formattaData(p.data))}` : ''}</span></li>`).join('')}</ul>
      </section>` : ''}
    ${risultati.length ? `
      <section class="scheda">
        <h2>Ultimi risultati</h2>
        <ul class="righe-partite">${risultati.map(p => rigaPartita(a, p)).join('')}</ul>
      </section>` : ''}`;
}
