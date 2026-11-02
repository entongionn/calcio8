# Calcio a 8 · Campionato AICS Siena

PWA per risultati, classifiche e (prossimamente) marcatori e disciplina del campionato provinciale
AICS di calcio a 8. Funziona nel browser di iPhone, Android e PC, anche offline, senza server e
senza costi. I requisiti sono in [Prompt_Aics.md](Prompt_Aics.md).

## Stato

| Passo | Contenuto | Stato |
|---|---|---|
| 1 | Struttura PWA, archivio sul dispositivo, backup e ripristino | fatto |
| 2 | Squadre, gironi, nomi alternativi, importazione del calendario dal PDF del comunicato (o dal testo incollato) | fatto |
| 3 | Classifiche con tutti i criteri di spareggio del regolamento | fatto |
| 4 | Lettura dei post Facebook (risultati provvisori) | da fare |
| 5 | Importazione del CUF in PDF (dati ufficiali, marcatori, disciplina, Fair-Play) | da fare |
| 6 | Coppa AICS | da fare |
| 7 | Pubblicazione dei dati, area pubblica, istruzioni di installazione | da fare |
| 8 | Fase 2 (Eccellenza / Promozione) | da fare |

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
con i suoi errori), risultati della 1ª giornata e coordinate dei frammenti di testo dei due PDF.
I PDF non sono nel progetto, perché contengono numeri di telefono e IBAN.

## Struttura

```
app/                  l'app da pubblicare (solo file statici)
  index.html, manifest.webmanifest, sw.js, css/, icons/
  js/
    archivio.js       formato dei dati, confronto e unione di archivi (backup senza duplicati)
    calendario.js     lettura e controllo del calendario (dal PDF o dal testo incollato)
    pdf.js            estrazione del testo dai PDF dei comunicati
    classifica.js     calcolo della classifica secondo il Par.2 del regolamento
    normalizza.js     riconoscimento dei nomi di squadra scritti male
    seed.js           squadre e gironi 2026-2027
    db.js, stato.js   salvataggio in IndexedDB e copie automatiche
    backup.js         esportazione JSON e promemoria
    viste/            schermate
tests/                test (Node e browser), dati reali in fixtures/
strumenti/            genera_icone.py: rigenera le icone PNG (solo libreria standard)
```

## Dipendenze e servizi esterni

- **Per usare l'app:** nessuna. Niente framework, CDN, account o API.
- **Per sviluppare:** Node.js (solo per i test da riga di comando) e Python (server locale, icone). Facoltativi.
- **pdf.js 4.10.38** (Mozilla, Apache 2.0), build "legacy" compatibile con i Safari meno recenti, in
  `app/vendor/pdfjs/` (file rinominati da `.mjs` a `.js`): incluso nell'app, non caricato da CDN. Si scarica solo quando si importa un PDF
  e poi resta disponibile offline.
- **Dal passo 7:** un hosting statico gratuito. È sostituibile in qualsiasi momento, perché l'app è fatta solo di file.

## Dati e sincronizzazione

- I dati stanno nel browser del dispositivo (IndexedDB). **Non si sincronizzano** con altri dispositivi.
- Per spostarli o conservarli si usa il **backup** (file JSON). L'importazione mostra un'anteprima
  (nuovi / uguali / diversi) e non crea duplicati: ogni partita ha un id derivato da girone + casa + ospite.
- Prima di ogni operazione rischiosa, e una volta al giorno, l'app salva una **copia automatica**
  (ultime 30), ripristinabile da Gestione.
- Su iPhone, eliminare l'icona dalla schermata Home cancella i dati dell'app: serve un backup.
- La condivisione con chi consulta arriverà al passo 7 (pubblicazione di `dati.json`, in sola lettura per gli altri).

## Scelte da confermare

- **Spareggi:** se un criterio separa solo una parte delle squadre a pari punti, al gruppo rimasto si
  riapplicano i criteri dall'inizio (es. 3 squadre → avulsa → 2 restano pari → scontri diretti tra le due).
  Il regolamento non lo specifica. L'alternativa (proseguire con il criterio successivo) è già implementata:
  `riapplica: false` in `classifica.js`.
- **Scontri diretti non ancora giocati:** non contano e si passa al criterio successivo, come fanno i comunicati.
- **Fair-Play:** il criterio è pronto, ma i dati arriveranno con il passo 5. Fino ad allora una parità che
  arriva al Fair-Play viene segnalata e si può risolvere con l'ordine del sorteggio.
