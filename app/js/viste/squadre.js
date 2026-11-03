import * as stato from '../stato.js';
import { chiave } from '../normalizza.js';
import { avvisa, esc } from '../util.js';
import { gironiCampionato, testata, vistaBenvenuto } from './comuni.js';

export function vistaSquadre(el) {
  const a = stato.corrente();
  if (!a) return vistaBenvenuto(el);

  el.innerHTML = `
    ${testata('Nomi alternativi', '#/gestione')}
    <p class="nota">I nomi alternativi servono a riconoscere la squadra quando i comunicati o i post la scrivono in modo diverso.
    I refusi più comuni vengono già riconosciuti da soli.</p>
    ${gironiCampionato(a).map(g => `
      <section class="scheda">
        <h2>${esc(g.nome)}</h2>
        <ul class="elenco squadre-elenco">
          ${g.squadre.map(id => {
            const s = a.squadre.find(x => x.id === id);
            return `
            <li data-squadra="${esc(id)}">
              <div class="nome-squadra">
                <strong>${esc(s.nome)}</strong>
                <button class="collegamento" data-rinomina>Rinomina</button>
              </div>
              <div class="alias">
                ${(s.alias ?? []).map(al => `<span class="chip">${esc(al)}<button data-togli="${esc(al)}" aria-label="Togli ${esc(al)}">×</button></span>`).join('')}
                <form class="aggiungi-alias"><input name="alias" placeholder="Altro nome" aria-label="Nuovo nome alternativo per ${esc(s.nome)}"><button class="secondario" type="submit">Aggiungi</button></form>
              </div>
            </li>`;
          }).join('')}
        </ul>
      </section>`).join('')}`;

  const usatoDaAltri = (testo, id) => a.squadre.some(s => s.id !== id && [s.nome, ...(s.alias ?? [])].some(n => chiave(n) === chiave(testo)));

  el.querySelectorAll('[data-squadra]').forEach(li => {
    const id = li.dataset.squadra;
    const s = a.squadre.find(x => x.id === id);

    li.querySelector('.aggiungi-alias').addEventListener('submit', async e => {
      e.preventDefault();
      const nuovo = e.target.alias.value.trim();
      if (!nuovo) return;
      if (usatoDaAltri(nuovo, id)) return avvisa(`«${nuovo}» è già usato per un'altra squadra`, 'errore');
      if ([s.nome, ...(s.alias ?? [])].some(n => chiave(n) === chiave(nuovo))) return avvisa('Nome già presente', 'errore');
      await stato.modifica(arch => {
        const x = arch.squadre.find(y => y.id === id);
        x.alias = [...(x.alias ?? []), nuovo];
      });
      avvisa('Nome alternativo aggiunto');
    });

    li.querySelectorAll('[data-togli]').forEach(b => b.addEventListener('click', async () => {
      await stato.modifica(arch => {
        const x = arch.squadre.find(y => y.id === id);
        x.alias = x.alias.filter(al => al !== b.dataset.togli);
      });
    }));

    li.querySelector('[data-rinomina]').addEventListener('click', async () => {
      const nuovo = prompt(`Nuovo nome per ${s.nome}:`, s.nome)?.trim();
      if (!nuovo || nuovo === s.nome) return;
      if (usatoDaAltri(nuovo, id)) return avvisa(`«${nuovo}» è già usato per un'altra squadra`, 'errore');
      await stato.modifica(arch => {
        const x = arch.squadre.find(y => y.id === id);
        // Il vecchio nome resta come alternativo, così i comunicati precedenti vengono ancora riconosciuti.
        x.alias = [...new Set([...(x.alias ?? []), x.nome])].filter(al => chiave(al) !== chiave(nuovo));
        x.nome = nuovo;
      });
      avvisa('Squadra rinominata');
    });
  });
}
