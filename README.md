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

I JSON in `src/data/` restano principalmente come:

- sorgente storica
- backup
- input per script di import o generazione

Nota importante:

- le sessioni login sono ancora in memoria server
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

Patch incremental già aggiunte:

- `prisma/sqlite-add-spell.sql`
- `prisma/sqlite-add-rules.sql`

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

## Note operative

- In questo ambiente Prisma non riesce a usare in modo affidabile `migrate dev` / `db push` per un problema del `schema engine`.
- Per questo il progetto usa un workaround pratico:
  - schema Prisma come fonte autorevole
  - SQL generato da Prisma
  - applicazione del SQL via `sqlite3`

Questo non impedisce di usare SQLite o Prisma nel progetto, ma e' bene saperlo prima di lavorare sulla migrazione.

## Prossimi passi

Le aree ancora aperte lato migrazione sono principalmente:

- verifica funzionale completa
- eventuale persistenza delle sessioni nel DB
- cleanup finale del layer JSON storico
