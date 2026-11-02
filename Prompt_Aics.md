## REQUISITI VINCOLANTI: MULTIPIATTAFORMA E COSTO ZERO

### 1. Compatibilità

L'applicazione deve funzionare su:

- iPhone tramite Safari;
- smartphone Android tramite Chrome;
- PC tramite un browser moderno, utile per amministrare e correggere i dati.

La soluzione preferita è una Progressive Web App (PWA), installabile sulla schermata Home e progettata con interfaccia responsive.

Non sviluppare due applicazioni separate per iOS e Android.

L'interfaccia deve essere utilizzabile con una mano, avere testi leggibili, navigazione semplice e tabelle adattate agli schermi piccoli.

Verifica le differenze tra Safari iOS e Chrome Android, comprese le modalità di installazione e i limiti del funzionamento offline.

### 2. Vincolo assoluto: costo zero

Il progetto deve essere realizzabile e utilizzabile senza spese obbligatorie.

Non utilizzare:
- hosting a pagamento;
- database cloud a pagamento;
- API commerciali a consumo;
- modelli AI con costi per richiesta;
- abbonamenti obbligatori;
- servizi esterni a pagamento per notifiche o sincronizzazione;
- licenze software commerciali necessarie al funzionamento.

Preferire tecnologie gratuite e open source, indicando eventuali eccezioni e relativi limiti.

Il requisito di costo zero riguarda anche l'utilizzo ordinario: non deve essere necessario pagare un servizio per continuare a consultare risultati, classifiche e marcatori.

### 3. Architettura da valutare per rispettare il costo zero

Valuta prioritariamente questa soluzione:

- frontend PWA realizzato con HTML, CSS e JavaScript oppure con un framework open source solo se realmente utile;
- backend Python, se necessario;
- database SQLite;
- importazione manuale dei testi dei post Facebook;
- calcolo locale delle classifiche quando possibile;
- nessuna dipendenza obbligatoria da servizi cloud.

Prima di introdurre un backend sempre attivo, verifica se la prima versione può funzionare direttamente nel browser e salvare i dati sul dispositivo.

Confronta esplicitamente due architetture:

A. PWA locale, con dati memorizzati sul dispositivo e senza server permanente.

B. PWA con backend gratuito, necessaria se si vuole condividere lo stesso archivio tra più dispositivi.

Per ciascuna indica vantaggi, limiti, rischi di perdita dei dati, sincronizzazione e costi futuri.

Non dare per scontato che un servizio di hosting gratuito sia sempre gratuito, disponibile o privo di limiti.

### 4. Sincronizzazione e persistenza

L'app deve distinguere chiaramente tra:

- dati memorizzati sul singolo dispositivo;
- dati condivisi tra i dispositivi;
- dati esportati come backup.

Se la sincronizzazione tra iPhone e Android richiede un server, spiegalo chiaramente e proponi la soluzione a costo zero più affidabile.

Non promettere sincronizzazione automatica tra telefoni diversi se non esiste un archivio condiviso.

Prevedi almeno:
- esportazione del database o dei dati in JSON;
- importazione di un backup;
- gestione dei duplicati;
- protezione contro la perdita accidentale dei dati.

### 5. Installazione e distribuzione

L'app deve essere utilizzabile senza pubblicazione sugli store.

Fornisci istruzioni distinte per:
- aggiungerla alla schermata Home su iPhone;
- installarla su Android;
- utilizzarla da PC.

Spiega i requisiti HTTPS e le eventuali differenze tra installazione e semplice collegamento alla schermata Home.

Non richiedere account o registrazioni per la versione locale.

### 6. Facebook senza costi

La prima versione deve funzionare senza API a pagamento e senza accessi non autorizzati.

Prevedi l'incollaggio del testo dei post Facebook e la successiva revisione dei dati.

L'eventuale lettura automatica della pagina deve essere considerata una funzionalità separata, da valutare solo se realizzabile attraverso metodi ufficiali, autorizzati e senza costi obbligatori.

Se non è possibile garantirla, non compromettere il requisito di costo zero: mantenere l'importazione manuale.

### 7. Criteri di accettazione aggiuntivi

Il progetto non è accettabile finché:

1. la stessa interfaccia non è utilizzabile su iPhone e Android;
2. la versione base non funziona senza abbonamenti o API a pagamento;
3. è possibile importare, esportare e recuperare i dati;
4. i risultati e le classifiche sono calcolati correttamente;
5. sono documentati i limiti della sincronizzazione tra dispositivi;
6. tutte le dipendenze e i servizi esterni sono dichiarati;
7. nessuna funzionalità essenziale dipende da un servizio che potrebbe diventare a pagamento senza una strategia alternativa.

### 8. Istruzioni per la prima fase

Analizza il progetto esistente senza modificare file.

Confronta le architetture possibili e raccomanda quella che soddisfa meglio compatibilità multipiattaforma, affidabilità, semplicità e costo zero.

Non iniziare l'implementazione fino alla mia approvazione.