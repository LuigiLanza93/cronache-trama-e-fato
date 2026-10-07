# Procedure Railway e persistenza

Trasferite dalle note locali il 2026-10-01. Le regole comuni sono in AGENTS.md.
I dettagli di configurazione sono attesi dalle note storiche e vanno verificati
prima di una release: nessun accesso Railway effettuato durante il trasferimento.

## Sequenza di release e fallimenti

1. Verificare autorizzazione, commit approvati, worktree, gate automatici,
   target Railway e rollback; preservare lavoro estraneo.
2. Prima del merge e di ogni mutazione/deploy rischioso verificare un backup
   esterno fresco. Writer, serializzazione, import, bootstrap e file persistenti
   contano anche senza migrazione. Lo script DB non salva ritratti/altri file:
   per questi prevedere backup coerente separato.
3. Su `main`, creare il merge `git merge --no-ff dev` con messaggio esplicito;
   pushare e deployare quello stesso commit da un checkout pulito, senza
   includere il lavoro non committato nello snapshot CLI.
4. Applicare SQL revisionata nell'ordine del piano della release tramite il
   canale controllato e verificato disponibile. Questo runbook non fornisce un
   comando universale di applicazione SQL: se manca una procedura verificata,
   fermare la fase. Non riapplicare migrazioni alla cieca da `migrate status`.
5. Verificare salute, protezione API da sloggati, login, flussi DM/player,
   integrità/FK/conteggi e persistenza/restart quando pertinente. Dopo successo,
   fast-forward di `dev` al tip `main` distribuito e push `origin/dev`.

Se merge/push riesce ma deploy fallisce, registrare release incompleta, commit
e stato effettivo. Verificare stato/log prima di ritentare lo stesso commit.
Backup falliti o anomalie critiche bloccano le fasi dipendenti. Nessun rollback
automatico; restore e rollback produttivi richiedono autorizzazione separata.

Lo script backup controlla dimensione e SHA-256 quando disponibile: verificare
anche `integrity_check` sulla copia in sola lettura e registrare percorso,
timestamp, hash ed esito. Retention predefinita: 30 copie; preservare la copia
pre-release fino al completamento. I dettagli di task Windows e deploy storici
riportati sotto devono essere verificati, non assunti come stato corrente.

## Regola DB Produzione/Locale

- Dal deploy Railway in avanti il DB canonico/reale e' quello sul volume Railway: `/data/migration.db`, esposto tramite `DATABASE_URL=file:/data/migration.db`.
- `prisma/migration.db` nel workspace locale e' il DB ufficiale operativo di sviluppo: su `dev` va migrato e mutato normalmente per implementazione e collaudi end-to-end. Non serve lavorare su una copia per i normali test funzionali; usare copie disposable soltanto per prove deliberatamente distruttive, fault injection o verifica rollback. I suoi dati non sono la fonte di verita' e possono differire dalla produzione.
- E' consentito applicare migrazioni, seed, backfill e modifiche dati a `prisma/migration.db` come normale passaggio di sviluppo locale, senza trattarlo come operazione sulla produzione. Non usare mai questo file per sovrascrivere o riallineare Railway.
- Nuove feature/dati applicativi non devono essere aggiunti a `Character.data`: quel JSON resta legacy/transitorio per cio' che non e' ancora stato normalizzato o che sarebbe rischioso migrare ora. Per sviluppi nuovi usare tabelle/campi dedicati e API esplicite.
- Non usare mai il DB locale per "ripristinare", "allineare" o sovrascrivere la produzione salvo richiesta esplicita dell'utente e dopo backup verificato del DB Railway.
- Non committare modifiche accidentali a `prisma/migration.db` come se fossero aggiornamenti dati di produzione. Se cambia durante test locali, trattarlo come rumore locale salvo decisione esplicita.
- Le modifiche strutturali vanno progettate come migrazioni compatibili con il DB Railway reale: schema Prisma/source code nel repo, dati di produzione nel volume.
- Quando si rilascera M3/M4 e le fasi successive su Railway, applicare le migrazioni additive al DB reale esistente senza ricrearlo o sostituirlo con il DB locale: backup fresco verificato, dry-run/conteggi, ordine migrazioni documentato, transazioni restart-safe, controlli di integrita/FK e smoke test sui dati presenti.
- Prima di ogni intervento che tocca schema, seed, script DB, Prisma, bootstrap storage o endpoint di persistenza:
  - partire dal presupposto che produzione e locale siano disallineati;
  - eseguire o pianificare un backup del DB Railway;
  - evitare comandi che ricreano, resettano o sovrascrivono il DB;
  - testare localmente su copia/snapshot, non sul file canonico di produzione.
- Comandi come `prisma db push`, migration manuali, script SQL o import/export dati sono operazioni sensibili: usarli su produzione solo con comando esplicito, backup appena creato e piano di rollback.

### Regole Deploy Interventi DB Futuri

Principio base: il repo contiene codice, schema e script; i dati reali vivono su Railway. Ogni intervento DB va progettato per la produzione Railway, mentre il DB locale resta liberamente modificabile per sviluppo e deve essere mantenuto allineato allo schema corrente di `dev`; dati e contenuti locali possono differire dalla produzione.

#### 1. Nuove Strutture DB

Per nuove tabelle, colonne, indici o relazioni:

- preferire modifiche additive e compatibili: nuove tabelle, nuove colonne nullable o con default sicuro, indici non distruttivi;
- evitare reset, ricreazioni o sovrascritture del DB;
- verificare localmente su DB dev/snapshot senza considerarlo fonte dati canonica;
- eseguire sempre `npm.cmd run backup:prod-db` prima dell'intervento su Railway;
- deployare codice compatibile con la transizione;
- applicare la modifica schema su produzione solo con comando esplicito e non distruttivo;
- verificare dopo il deploy: `/healthz`, login, schermate coinvolte, lettura/scrittura dati interessati.

#### 2. Nuovi Censimenti DB

Per import, backfill o aggiornamenti di dati applicativi/reference data:

- usare script idempotenti e rieseguibili senza duplicare dati;
- usare chiavi stabili, slug o identificatori naturali quando possibile;
- non assumere che i record locali esistano uguali in produzione;
- prevedere conteggi, dry-run o riepilogo prima/dopo quando ragionevole;
- fare backup produzione prima dell'esecuzione;
- eseguire su Railway solo con comando esplicito;
- verificare con query/API/UI che i record attesi siano presenti e coerenti.

#### 3. Refactor Strutture Esistenti Con Dati Produzione

Per cambi strutturali su tabelle/campi gia' popolati in produzione:

- trattare la modifica come operazione ad alto rischio;
- fare backup produzione prima di ogni fase;
- usare approccio expand/migrate/verify/contract:
  - aggiungere prima la nuova struttura senza rimuovere la vecchia;
  - deployare codice compatibile con la transizione;
  - migrare/backfillare i dati in modo controllato e idempotente;
  - verificare conteggi, relazioni e schermate reali;
  - rimuovere vecchie colonne/tabelle/codice solo in una fase successiva e separata;
- non fare "tagli netti" su dati esistenti nello stesso deploy in cui si introduce il nuovo modello;
- ogni operazione distruttiva deve essere separata, motivata, confermata dall'utente e preceduta da backup appena creato.

Regola generale: restore e rollback DB non sono automatici. Si fanno solo manualmente, scegliendo esplicitamente un backup e creando prima un backup "pre-restore" del DB corrente.

## Strategia Backup/Recovery DB

Non dipendere da backup automatici Railway non verificati: usare il backup esterno controllato. La strategia deve quindi essere manuale, esterna a Railway e gestibile con strumenti nostri.

Decisione operativa:

- Implementare un flusso di backup manuale del DB Railway prima di ogni deploy rischioso, modifica schema o sessione importante.
- Il backup deve produrre un file SQLite consistente, non una copia grezza mentre il DB e' in scrittura. Preferire `VACUUM INTO` o API/script server-side equivalente.
- Conservare i backup fuori dal volume Railway, ad esempio in una cartella locale non versionata come `.backups/railway/`, con timestamp nel nome.
- Non salvare backup DB nel repository Git: possono contenere dati privati e contenuti interni.
- Mantenere almeno:
  - ultimo backup pre-deploy;
  - ultimo backup post-sessione reale;
  - qualche backup storico recente per tornare indietro se un problema viene scoperto tardi.

Piano tecnico consigliato:

- Endpoint tecnico implementato: `POST /api/admin/backups/database`.
- L'endpoint richiede `Authorization: Bearer <DATABASE_BACKUP_TOKEN>`; il token deve essere lungo almeno 32 caratteri e stare solo in variabile Railway + variabile ambiente locale, mai nel repo.
- L'endpoint genera un backup SQLite consistente del DB attivo con `VACUUM INTO` in una cartella temporanea e rimuove la copia dal volume dopo il download.
- Nota storica: deploy endpoint backup annotato il 2026-05-18; verificare disponibilita prima dell'uso.
- Verificare `DATABASE_BACKUP_TOKEN` su Railway e `CRONACHE_BACKUP_TOKEN` nell'ambiente locale; non salvare il segreto nel repo.
- Script locale implementato: `scripts/backup-prod-db.ps1`.
- Comando on demand: `npm.cmd run backup:prod-db`.
- Automazione Windows implementata: `scripts/register-prod-db-backup-task.ps1`.
- Comando install task giornaliero: `npm.cmd run backup:install-task`.
- Stato storico annotato del task Windows (da verificare): `CronacheProductionDatabaseBackup`, giornaliero alle 03:00, stato Ready.
- Primo backup reale scaricato e verificato il 2026-05-18 in `.backups/railway/` (~3.8 MB).
- Il PC deve avere `CRONACHE_BACKUP_TOKEN` o `DATABASE_BACKUP_TOKEN` come variabile ambiente.
- Per download backup: salvare in `.backups/railway/` o su altro storage esterno scelto dall'utente; `.backups/` e' ignorata da Git.
- Per restore: usare uno script/procedura separata e non automatica che carica esplicitamente un backup scelto dall'utente sul volume Railway e sostituisce `/data/migration.db` solo a servizio fermo o in modalita' manutenzione.
- Prima del restore: fare sempre un ulteriore backup "pre-restore" del DB corrente, anche se sembra corrotto o sbagliato.
- Dopo restore: avviare servizio, verificare `/healthz`, login, lettura utenti, schede, ritratti e Socket.IO.

Comandi:

```powershell
$env:CRONACHE_BACKUP_TOKEN='...'
npm.cmd run backup:prod-db
npm.cmd run backup:install-task
```

Automazione Windows: lo script registra un task giornaliero alle 03:00 chiamato `CronacheProductionDatabaseBackup`, usando una variabile ambiente utente per il token.

Nota: qualsiasi restore resta operazione manuale/sensibile e richiede conferma esplicita.


## Target e configurazione attesi (da verificare prima della release)

### Progetto Railway

- Workspace: `tano991's Projects`.
- Project: `cronache-trama-e-fato`.
- Project ID: `6cb28b65-18d8-4ae9-b0cf-463af5e77910`.
- Service: `web`.
- Service ID: `a8bf7718-f791-443c-a126-fcba30de1768`.
- Volume: `web-volume`.
- Volume ID: `e055d59d-71e4-485a-9360-b983338b8113`.
- Mount path: `/data`.
- Dominio pubblico attuale: `https://cronache-trama-fato.up.railway.app`.
- Vecchio dominio generato: `https://web-production-5d287.up.railway.app`.

### Variabili Railway

Variabili impostate sul servizio `web`:

```text
NODE_ENV=production
HOST=0.0.0.0
APP_DATA_DIR=/data
DATABASE_URL=file:/data/migration.db
SESSION_COOKIE_SECURE=true
TRUST_PROXY=1
APP_ORIGIN=https://cronache-trama-fato.up.railway.app
NIXPACKS_INSTALL_CMD=npm ci --include=dev --include=optional
NPM_CONFIG_PRODUCTION=false
NPM_CONFIG_OPTIONAL=true
```

### Deploy Railway Locale

- Railway CLI installata globalmente come `railway.cmd`.
- PowerShell blocca `railway.ps1`, quindi usa sempre `railway.cmd`.
- L'ambiente Codex non supporta login interattivo: usare token via env solo nella sessione, mai salvarlo su file.
- Quando Codex lancia `railway.cmd up`, la CLI puo' andare in timeout o non mostrare mai l'esito finale anche se Railway ha ricevuto il deploy. Non ritentare alla cieca: verificare stato e log Railway o coordinare un controllo dashboard.
- Dopo i fail `SNAPSHOT_CODE` del 2026-05-21, tenere fuori dagli snapshot Railway le cartelle temporanee `.tmp-railway-upload-*`. Il 2026-05-26 la CLI aggiornata ha accettato il deploy locale dopo backup e pulizia della cartella temporanea.
- Esempio:

```powershell
$env:RAILWAY_API_TOKEN='...'
railway.cmd up --service web --environment production --detach --message "descrizione deploy"
```

### Config Build Railway

- File `railway.json`.
- Nixpacks aveva problemi con optional native deps Linux.
- Workaround attuale nel build command:

```text
npm install @rollup/rollup-linux-x64-gnu@4.24.0 @swc/core-linux-x64-gnu@1.13.2 --no-save && npm run build
```

Se in futuro si ripresentano problemi di build native, valutare Dockerfile controllato invece di aggiungere altri workaround.

### Bootstrap Volume

`server.js` inizializza il volume persistente:

- Se `DATABASE_URL`/`SQLITE_DB_FILE` punta a un DB inesistente e `prisma/migration.db` esiste nel bundle, copia il DB iniziale nel volume.
- Se la cartella ritratti sul volume e' vuota, copia i ritratti iniziali da `public/portraits`.
- Dopo il primo avvio, DB e ritratti vivono in `/data`.
