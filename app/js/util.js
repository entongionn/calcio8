// Funzioni di supporto per l'interfaccia.

const ENTITA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(valore) {
  return String(valore ?? '').replace(/[&<>"']/g, c => ENTITA[c]);
}

const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function daIso(iso) {
  const [a, m, g] = iso.split('-').map(Number);
  return new Date(a, m - 1, g);
}

export function formattaData(iso, { giorno = true, anno = false } = {}) {
  if (!iso) return '';
  const d = daIso(iso);
  const testo = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}${anno ? `/${d.getFullYear()}` : ''}`;
  return giorno ? `${GIORNI[d.getDay()]} ${testo}` : testo;
}

export function formattaDataOra(isoCompleto) {
  if (!isoCompleto) return 'mai';
  const d = new Date(isoCompleto);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function giorniTrascorsi(isoCompleto) {
  if (!isoCompleto) return Infinity;
  return Math.floor((Date.now() - new Date(isoCompleto).getTime()) / 86400000);
}

export function uid(prefisso = 'id') {
  const casuale = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefisso}-${casuale}`;
}

export function scaricaFile(nome, contenuto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function puoCondividereFile() {
  try {
    const prova = new File(['{}'], 'prova.json', { type: 'application/json' });
    return Boolean(navigator.canShare?.({ files: [prova] }));
  } catch {
    return false;
  }
}

/** Apre il menu di condivisione del sistema. Restituisce false se l'utente annulla. */
export async function condividiFile(nome, contenuto, tipo = 'application/json') {
  const file = new File([contenuto], nome, { type: tipo });
  try {
    await navigator.share({ files: [file], title: nome });
    return true;
  } catch (e) {
    if (e.name === 'AbortError') return false;
    throw e;
  }
}

let timerAvviso = null;

export function avvisa(messaggio, tipo = 'ok') {
  const el = document.querySelector('#avviso');
  el.textContent = messaggio;
  el.dataset.tipo = tipo;
  el.hidden = false;
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => { el.hidden = true; }, 4000);
}
