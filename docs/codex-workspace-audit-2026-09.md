# Audit storico Codex settembre 2026

Snapshot superato: non usare come stato attuale o procedura CLI corrente.

## Audit del 2026-09-06, aggiornato il 2026-09-07

Stato osservato: `dev` a `c9e64f8`, M2/M3 non committati. I riferimenti Git
remoti sono quelli locali; Railway non verificato durante questo audit.
Codex CLI 0.153.0; Node 22.19.0; npm 10.9.3.

- Build positiva e 148/148 test P1/Gate in 11 file. La suite ha richiesto
  esecuzione fuori sandbox per un errore di accesso di esbuild prima dei test;
  i test distruttivi usano memoria o copie temporanee del DB.
- Prisma validate, controllo sintassi server/script M3 e TypeScript della
  configurazione Vite positivi. TOML degli otto file Codex valido; config
  principale caricato anche da `doctor --strict-config` usando una copia
  temporanea isolata, senza modificare le impostazioni personali.
- **TypeScript applicativo non passa** con `-p tsconfig.app.json`: il fallimento e
  stato riconfermato il 2026-09-07, con errori in
  componenti, provider auth, tipi inventario, effetti passivi e realtime.
  Le precedenti verifiche sul tsconfig radice non attestavano la correttezza
  dei tipi. La build Vite positiva non sostituisce questo controllo.
- Dry-run M3 locale: 12 classi, 14 sottoclassi, 6/6 PG risolti, zero scritture.
  Prisma segnala pero 14 migrazioni non registrate e differenze tra database
  e schema, comprese tabelle legacy e l'indice monoclasse M3 intenzionale.
  Il prossimo lavoro DB deve riconciliare cronologia e differenze su copie:
  non interpretare `migrate status` come istruzione a riapplicare tutte le SQL.
- Warning build: Browserslist obsoleta e chunk principale circa 650 kB.

Il checkpoint M2/M3 e stato ricontrollato il 2026-09-07: build, 148/148 test,
Prisma validate, TypeScript Vite, sintassi, dry-run M3 e `git diff --check` sono
positivi. Il type-check applicativo resta rosso e la riconciliazione Prisma
resta un lavoro separato; Railway non e stata verificata o modificata.
