# Calcio a 8 · Campionato AICS Siena

PWA per risultati, classifiche, marcatori e (prossimamente) disciplina del campionato provinciale
AICS di calcio a 8. Funziona nel browser di iPhone, Android e PC, anche offline, senza server e
senza costi. I requisiti sono in [Prompt_Aics.md](Prompt_Aics.md).

**App online:** <https://entongionn.github.io/calcio8/> (GitHub Pages, pubblicata dal branch `main`).
Sul telefono: iPhone → Safari → Condividi → *Aggiungi alla schermata Home*; Android → Chrome → ⋮ → *Installa app*.

## Stato

| Passo | Contenuto | Stato |
|---|---|---|
| 1 | Struttura PWA, archivio sul dispositivo, backup e ripristino | fatto |
| 2 | Squadre, gironi, nomi alternativi, importazione del calendario dal PDF del comunicato (o dal testo incollato) | fatto |
| 3 | Classifiche con tutti i criteri di spareggio del regolamento | fatto |
| 4 | Lettura dei post Facebook (risultati provvisori, marcatori, cartellini) e classifica marcatori | fatto |
| 5 | Importazione del CUF in PDF (dati ufficiali, marcatori, disciplina, Fair-Play) | da fare |
| 6 | Coppa AICS | da fare |
| 7 | Dati pubblicati per tutti, amministratore, grafica, logo, installazione | fatto |
| 8 | Fase 2 (Eccellenza / Promozione) | da fare |

## Come funziona

- **Chi consulta** apre l'app e vede i dati pubblicati in `app/dati.json`: niente account, niente
  da configurare. L'app li riscarica all'avvio, quando torna in primo piano e al ritorno della
  connessione; senza rete mostra gli ultimi scaricati.
- **L'amministratore** (Altro → Accesso amministratore) inserisce sul proprio telefono un token GitHub
  *fine-grained* limitato alla repository `entongionn/calcio8` con il solo permesso
  **Contents: Read and write**. Il token resta solo su quel telefono (IndexedDB) e non entra mai nei
  backup né nei dati pubblicati. Ogni modifica viene pubblicata da sola con un commit su
  `app/dati.json`; GitHub Pages la rende visibile a tutti in circa un minuto.
- **Post Facebook "in un gesto":** si copia il testo del post, si tocca *Incolla dagli appunti e importa*;
  le partite senza avvisi vengono salvate e pubblicate da sole, le altre restano in revisione.
  Su Android l'app compare anche tra le app di destinazione di *Condividi* (per il testo, es. da WhatsApp).
- **Lettura automatica di Facebook: non prevista.** Senza essere amministratori della pagina non
  esiste un metodo ufficiale e gratuito; lo scraping viola i termini di Meta ed è escluso dai requisiti.
  Il sito del comitato (sezione comunicati) è fermo alla stagione 2018-2019, quindi non è una fonte automatica.

## Avvio in locale

Service worker e installazione richiedono HTTPS oppure `localhost`. Dalla cartella del progetto:

```
python -m http.server 8765 --bind 127.0.0.1
```

- App: <http://localhost:8765/app/>
- Test nel browser: <http://localhost:8765/tests/test.html>

## Test

```
node tests/run.js
```

I test usano i dati reali dei Comunicati Ufficiali n.1 e n.2: calendario fino a Natale (75 partite,
con i suoi errori), risultati della 1ª giornata, coordinate dei frammenti di testo dei due PDF e post
Facebook del comitato. Le chiamate a GitHub sono simulate.
I PDF non sono nel progetto, perché contengono numeri di telefono e IBAN.

## Struttura

```
app/                  l'app da pubblicare (solo file statici)
  index.html, manifest.webmanifest, sw.js, css/, icons/, img/
  dati.json           i dati pubblicati (scritti dall'app dell'amministratore)
  js/
    archivio.js       formato dei dati, confronto e unione di archivi (backup senza duplicati)
    calendario.js     lettura e controllo del calendario (dal PDF o dal testo incollato)
    pdf.js            estrazione del testo dai PDF dei comunicati
    facebook.js       lettura dei post Facebook: risultato, marcatori, ammoniti, espulsi, arbitro
    marcatori.js      classifica marcatori
    classifica.js     calcolo della classifica secondo il Par.2 del regolamento
    pubblica.js       pubblicazione su GitHub e allineamento con i dati pubblicati
    stemmi.js         stemmi delle squadre (colori sociali del CUF 2) e avatar dei giocatori
    normalizza.js     riconoscimento dei nomi di squadra scritti male
    seed.js           squadre e gironi 2026-2027
    db.js, stato.js   salvataggio in IndexedDB, copie automatiche, ruolo e pubblicazione
    backup.js         esportazione JSON
    viste/            schermate
tests/                test (Node e browser), dati reali in fixtures/
strumenti/            genera_logo.mjs (logo SVG) e genera_icone.mjs (icone PNG con un browser headless)
```

## Dipendenze e servizi esterni

- **Per usare l'app:** nessuna. Niente framework, CDN o account per chi consulta.
- **GitHub (gratuito):** repository pubblica, GitHub Pages per la pubblicazione, API dei contenuti
  per gli aggiornamenti dell'amministratore. Se un giorno non fosse più disponibile, l'app (solo file
  statici) e `dati.json` si spostano su qualsiasi altro hosting; l'amministratore può sempre esportare
  un backup.
- **Per sviluppare:** Node.js (test, logo) e un browser Chromium (icone PNG); Python facoltativo per il server locale.
- **pdf.js 4.10.38** (Mozilla, Apache 2.0), build "legacy" compatibile con i Safari meno recenti, in
  `app/vendor/pdfjs/` (file rinominati da `.mjs` a `.js`): incluso nell'app, non caricato da CDN.
  Si scarica solo quando si importa un PDF e poi resta disponibile offline.

## Dati e sincronizzazione

- Sul telefono i dati stanno nel browser (IndexedDB); quelli condivisi sono `app/dati.json`, e ogni
  versione resta nella cronologia della repository.
- Allineamento: chi consulta prende sempre la versione pubblicata più recente. L'amministratore pubblica
  le sue modifiche; se nel frattempo i dati sono cambiati da un altro dispositivo, le due versioni
  vengono unite e per le differenze vale il suo telefono. Una versione pubblicata più vecchia di quella
  già nota (cache di GitHub Pages) viene ignorata.
- Il **backup** (file JSON) resta disponibile in Gestione. L'importazione mostra un'anteprima
  (nuovi / uguali / diversi) e non crea duplicati: ogni partita ha un id derivato da girone + casa + ospite,
  ogni giocatore da squadra + nome. Le grafie diverse dello stesso giocatore restano come nomi alternativi.
- Formato dei dati: versione 2 (aggiunti giocatori ed eventi). I dati e i backup della versione 1 vengono
  aggiornati automaticamente.
- Prima di ogni operazione rischiosa, e una volta al giorno, l'app salva una **copia automatica**
  (ultime 30), ripristinabile da Gestione.

## Grafica

Tema scuro con accento viola. Logo originale (pallone con nastro tricolore), non il marchio AICS.
Le squadre non hanno loghi: gli stemmi sono disegnati con i colori sociali comunicati nel CUF 2 e le
iniziali; i giocatori hanno un avatar con le iniziali. Foto del campo nella Home fornita dall'amministratore.

## Scelte da confermare

- **Spareggi:** se un criterio separa solo una parte delle squadre a pari punti, al gruppo rimasto si
  riapplicano i criteri dall'inizio (es. 3 squadre → avulsa → 2 restano pari → scontri diretti tra le due).
  Il regolamento non lo specifica. L'alternativa (proseguire con il criterio successivo) è già implementata:
  `riapplica: false` in `classifica.js`.
- **Scontri diretti non ancora giocati:** non contano e si passa al criterio successivo, come fanno i comunicati.
- **Post Facebook con squadre scritte al contrario:** se la giornata del post (o, senza giornata, la data)
  indica la partita con casa e ospite invertiti, l'app la usa e lo segnala.
- **Gare a tavolino:** i gol non contano per la classifica marcatori.
- **Fair-Play:** il criterio è pronto, ma i dati arriveranno con il passo 5. Fino ad allora una parità che
  arriva al Fair-Play viene segnalata e si può risolvere con l'ordine del sorteggio.
- **Dati iniziali:** la 1ª giornata pubblicata viene dal CUF 2 (risultati, marcatori, ammoniti, dirigenti
  espulsi). Il CUF contiene incongruenze, riportate così come sono: Terre di Siena–Agriarte 7-1 con 8 gol
  attribuiti; Sienna United 9 gol con 6 attribuiti; Ponte d'Arbia 5 gol con 4 attribuiti.
