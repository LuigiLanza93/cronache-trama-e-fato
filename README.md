# Cronache della Trama e del Fato

Applicazione web locale per la gestione di campagne D&D 5e con:

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

## Requisiti

- Node.js 22+
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
- vedere gli indirizzi locale e di rete
- copiare uno degli indirizzi da condividere con chi deve collegarsi
- aprire l'app nel browser

La configurazione locale del cruscotto viene salvata in:

- `local-tools/.dev-dashboard/settings.json`

In produzione locale:

```bash
npm run build
npm run start
```

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

## Stato Migrazione

La migrazione principale a SQLite e' completata:

- runtime applicativo su database
- sessioni login persistenti su DB
- layer JSON runtime spento per le feature principali
- JSON storici conservati in `src/data/JSON_LEGACY`

I prossimi passi non sono piu' la migrazione core, ma:

- manutenzione e hardening
- eventuale cleanup del codice legacy rimasto
- merge del branch `migration` in `main` quando il team lo ritiene pronto
