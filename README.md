# Cronache della Trama e del Fato

> Aggiornamento 2026-10-02: preview autorevole, diario delle decisioni e concessioni,
> background personalizzato e varianti, risorse iniziali integrate. Database locale
> allineato; nessuna modifica Railway. [Checkpoint corrente](docs/rules-inventory/implementation-step-two.md).
> Le verifiche datate nei paragrafi precedenti descrivono incrementi storici.

Applicazione web locale/privata per la gestione di campagne di gioco di ruolo con:

- schede personaggio realtime
- dashboard DM
- tracker iniziativa
- bestiario
- chat privata DM <-> personaggio
- gestione utenti e assegnazione schede

Lo stack attuale usa:

- `React + Vite` per il frontend
- `Express + Socket.IO` per backend e realtime
- `SQLite` come database locale
- `Prisma` come source of truth dello schema

## Creazione e progressione: ultimo incremento

Consolidamento su `dev` autorizzato il **2026-10-07**, incluso l'assetto dei file
e della configurazione Codex. Collaudo browser ancora aperto; verifiche
automatiche precedenti e perimetro nel [checkpoint corrente](docs/rules-inventory/implementation-step-two.md).

Catalogo PHB di 361 magie, dettagli nel wizard e nella scheda, validator
comune e primi eventi dichiarativi. Corrette lingue automatiche, expertise
e strumento iniziale del Bardo. P1 245/245; build e TypeScript superati.
Modifiche locali non committate, level up completo ancora aperto.
[Stato e limiti](docs/rules-inventory/implementation-step-one.md).

## Stato attuale

Il runtime applicativo legge i dati principali da SQLite:

- utenti
- schede personaggio
- ownership personaggi
- mostri
- incantesimi
- skill
- progressioni slot incantesimo
- chat
- scenari di combattimento
- sessioni login

I JSON storici sono stati spostati in `src/data/JSON_LEGACY` e restano principalmente come:

- sorgente storica
- backup
- input per script di import o generazione

Nota importante:

- le sessioni login sono persistite nel database SQLite
- la roadmap della migrazione e' in `docs/sqlite-prisma-roadmap.md`

### Creazione e progressione dei personaggi

Al checkpoint del 2026-10-01, la copia di sviluppo su `dev` include la creazione guidata DM di PG di livello 1, con scelte iniziali, point buy, background, equipaggiamento, privilegi di origine e magie raggruppate per livello nella scheda. Le modifiche della creazione restano non committate e il collaudo completo è aperto. L1 e MC1 forniscono già la progressione mono/multiclasse nel perimetro collaudato; tutte le scelte interne ai privilegi e alle magie dei livelli successivi non sono ancora automatizzate.

La priorità concordata è censire le regole di tutte le razze e classi del Manuale del Giocatore e completare la valutazione di un modello comune per creazione e level up prima di aggiungere altre scelte puntuali.

- [Stato della creazione, verifiche e limiti](docs/character-creation-level-one.md).
- [Audit del modello comune](docs/character-creation-progression-model-audit.md).
- [Inventario PHB e contratto di decisioni](docs/rules-inventory/README.md).
- [Piano di collaudo della creazione](docs/level-one-creation-manual-test-plan.md).
- [Roadmap di prodotto](docs/product-roadmap.md) e [progressione/M8](docs/multiclass-roadmap.md).

## Requisiti

- Node.js 22.x
- npm

Su Windows e' disponibile anche un client SQLite locale gia' incluso:

- `tools/sqlite/sqlite3.exe`

## Avvio rapido

Installa le dipendenze:

```bash
npm install
```

Avvia in sviluppo:

```bash
npm run dev
```

Apri:

```text
http://localhost:3000
```

Su Windows puoi anche usare il cruscotto di sviluppo:

- fai doppio click su `Apri cruscotto dev.cmd`
- oppure avvia `Apri cruscotto dev.vbs`

Il cruscotto ti permette di:

- avviare, fermare e riavviare il server
- cambiare e salvare la porta di avvio
- scegliere la modalita di avvio: sessione giocatori in produzione LAN, solo DM locale, oppure sviluppo locale
- aggiornare la build di produzione con il pulsante `Build`
- vedere gli indirizzi locale e di rete
- copiare uno degli indirizzi da condividere con chi deve collegarsi
- aprire l'app nel browser

Per giocare con i player usa `Sessione giocatori - produzione LAN`. Prima di usarla dopo modifiche al codice, aggiorna la build dal cruscotto oppure con:

```bash
npm run build
```

La configurazione locale del cruscotto viene salvata in:

- `local-tools/.dev-dashboard/settings.json`

In produzione locale:

```bash
npm run build
npm run start
```

## Configurazione hosting

Per un deploy su Railway o servizi simili, mantieni un volume persistente per database e immagini caricate.

Variabili ambiente consigliate:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=<assegnata dal provider>
APP_DATA_DIR=/data
DATABASE_URL=file:/data/migration.db
SESSION_COOKIE_SECURE=true
TRUST_PROXY=1
APP_ORIGIN=https://tuo-dominio.example
```

Con `APP_DATA_DIR=/data`, l'app salva i ritratti in `/data/portraits`. `DATABASE_URL` deve puntare a un file SQLite nello stesso volume persistente.

Prima del primo deploy pubblico usa un database di prova o sanificato. Migra il database reale solo dopo aver verificato login, permessi e persistenza del volume.

## Database

Il database SQLite locale usato dal progetto e':

- `prisma/migration.db`

Schema Prisma:

- `prisma/schema.prisma`

Bootstrap SQL generato da Prisma:

- `prisma/sqlite-init.sql`

Patch incrementali gia' aggiunte:

- `prisma/sqlite-add-spell.sql`
- `prisma/sqlite-add-rules.sql`
- `prisma/sqlite-add-sessions.sql`

## Comandi utili

Build frontend:

```bash
npm run build
```

Avvio produzione:

```bash
npm run start
```

Generazione client Prisma:

```bash
npm run prisma:generate
```

Validazione schema Prisma:

```bash
npx prisma validate
```

Studio dati con Prisma Studio:

```bash
npm run prisma:studio
```

Import dei JSON nel DB:

```bash
npm run db:import-json
```

Lo script legge i dati storici da:

- `src/data/JSON_LEGACY`

Dry run dell'import:

```bash
node scripts/import-json-to-sqlite.mjs --dry-run
```

Estrazione SRD bestiario:

```bash
npm run extract:bestiary
```

## Accesso al DB

Da Prompt dei comandi:

```cmd
cd /d <percorso-del-progetto>
tools\sqlite\sqlite3.exe prisma\migration.db
```

Query utili:

```sql
.tables
.schema
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Character";
SELECT COUNT(*) FROM "Monster";
SELECT COUNT(*) FROM "Spell";
SELECT COUNT(*) FROM "Session";
```

DBeaver funziona bene puntando direttamente a:

```text
prisma/migration.db
```

## Struttura utile

Backend principale:

- `server.js`

Client auth e API:

- `src/lib/auth.ts`

Realtime client:

- `src/realtime.ts`

Pagine principali:

- `src/pages/CharacterSheet.tsx`
- `src/pages/DMDashboard.tsx`
- `src/pages/InitiativeTracker.tsx`
- `src/pages/BestiaryManagement.tsx`

Script di migrazione:

- `scripts/import-json-to-sqlite.mjs`

Cruscotto sviluppo Windows:

- `Apri cruscotto dev.cmd`
- `Apri cruscotto dev.vbs`
- `local-tools/dev-dashboard.ps1`

Archivio storico JSON:

- `src/data/JSON_LEGACY`

## Note operative

- In questo ambiente Prisma non riesce a usare in modo affidabile `migrate dev` / `db push` per un problema del `schema engine`.
- Per questo il progetto usa un workaround pratico:
  - schema Prisma come fonte autorevole
  - SQL generato da Prisma
  - applicazione del SQL via `sqlite3`

Questo non impedisce di usare SQLite o Prisma nel progetto, ma e' bene saperlo prima di lavorare sulla migrazione.

## Flusso Git e release

- `dev` e' il branch di sviluppo e test.
- `main` rappresenta esclusivamente lo stato rilasciato in produzione.
- Una release autorizzata unisce `dev` in `main` con un merge commit esplicito `--no-ff`, anche quando sarebbe possibile un fast-forward. In questo modo il confine della release resta visibile nel grafico Git.
- Il tip risultante di `main` viene distribuito su Railway come parte dello stesso flusso; `main` non deve restare aggiornato ma non deployato.
- Dopo la verifica positiva del deploy, `dev` viene riallineato con fast-forward al tip distribuito di `main` e pushato su `origin/dev`.
- I merge di release non vengono compressi con squash e non usano fast-forward, salvo decisione esplicita diversa.

Comando di riferimento dalla copia di lavoro pulita su `main`:

```powershell
git merge --no-ff dev -m "Release vX.Y.Z: titolo release"
```

## Stato Migrazione

La migrazione principale a SQLite e' completata:

- runtime applicativo su database
- sessioni login persistenti su DB
- layer JSON runtime spento per le feature principali
- JSON storici conservati in `src/data/JSON_LEGACY`

I prossimi passi non sono piu' la migrazione core, ma:

- manutenzione e hardening
- eventuale cleanup del codice legacy rimasto
- sviluppo ordinario su `dev` e release controllate su `main`
