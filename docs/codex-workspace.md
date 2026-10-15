# Workspace Codex

Le regole condivise sono in `AGENTS.md`; `.codex/config.toml` configura il
progetto e `.codex/agents/*.toml` definisce i sette specialisti. Il modello
principale resta una preferenza personale, senza override nel repository.

## Avvio e contesto

1. Aprire la radice del repository e controllare `git status --short --branch`.
   Lo sviluppo avviene su `dev`; preservare le modifiche gia presenti.
2. Leggere `AGENTS.md` e, se presente, `codex-readme.md`: contiene stato corrente
   e procedure locali. `codex-history.md` conserva le note storiche; consultarlo
   solo quando serve. Entrambi sono ignorati da Git.
3. In un clone/worktree nuovo ricostruire lo stato da Git, `README.md`,
   `docs/product-roadmap.md`, `docs/multiclass-roadmap.md` e dai runbook pertinenti.
   Non copiare segreti o database da altri ambienti e non dedurre lo stato
   Railway dallo schema locale. L'assenza delle note locali non blocca lo sviluppo.
4. Verificare Node 22.x e usare i comandi `.cmd` in PowerShell. Installare le
   dipendenze con `npm.cmd ci` se mancanti; avviare con `npm.cmd run dev`.
   Il database locale va preparato usando le migrazioni e le procedure della
   feature interessata, mai importando automaticamente il JSON legacy.

## Agenti e configurazione

- Due subagent concorrenti al massimo, oltre al root; profondita uno.
  Scegliere il minimo numero utile e assegnare file distinti agli agenti scriventi.
- `quality_security` lavora in sola lettura. Il root esegue le verifiche che
  richiedono artefatti di build o database temporanei se la sandbox le impedisce.
- `git_finalize` richiede test utente confermato e lista esatta dei file.
  `release_railway` richiede autorizzazione esplicita alla produzione.
- I file TOML degli agenti sono scoperti da `.codex/agents/`; non occorre
  duplicarne le definizioni nel config principale.
- Il progetto deve essere attendibile nelle impostazioni personali di Codex
  per caricare la configurazione locale. Non impostare trust per interi dischi
  per risolvere un problema del singolo repository.
- Le modifiche alla configurazione vanno verificate in una nuova sessione;
  una sessione gia aperta puo mantenere le impostazioni precedenti.

### Profilo Plus: qualita e consumo

Configurazione scelta il 2026-09-06:

| Agente | Modello | Ragionamento |
| --- | --- | --- |
| Generico, senza override di ruolo | GPT-5.6 Terra | medium |
| frontend_ui | GPT-5.6 Terra | medium |
| game_rules_data | GPT-5.6 Terra | medium |
| git_finalize | GPT-5.6 Terra | low |
| backend_realtime | GPT-5.6 Sol | high |
| database_migrations | GPT-5.6 Sol | high |
| quality_security | GPT-5.6 Sol | high |
| release_railway | GPT-5.6 Sol | high |

Terra/medium e ora il default dei subagent generici, anche quando il coordinatore
usa Astra. I ruoli specializzati conservano i propri override. Il limite passa
da quattro a due subagent concorrenti: per risparmiare conta anche ridurre
deleghe totali, contesto duplicato e verifiche ripetute, come descritto in AGENTS.md.
Le regole di gioco ordinarie passano da Terra/high a Terra/medium; per progressione
multiclasse e casi irrisolti il coordinatore integra l'analisi con maggiore profondita.

Coordinatore consigliato: **GPT-5.6 Sol / medium** per questo progetto con backend,
regole e persistenza intrecciati. Terra/medium per interventi semplici e circoscritti;
Sol/high per pianificazione difficile; Astra/medium o high solo per problemi
eccezionali. La preferenza personale del coordinatore non viene cambiata dal repo.
Questa e una scelta operativa, non una garanzia di risparmio misurato: verificare
l'andamento nella dashboard di utilizzo Plus. Non usare xhigh/max di routine.

## Verifiche

Eseguire i controlli pertinenti alla modifica, dalla radice:

```powershell
npm.cmd run build
npx.cmd tsc -p tsconfig.app.json --noEmit --pretty false
npx.cmd tsc -p tsconfig.node.json --noEmit --pretty false
npm.cmd run test:p1
npx.cmd prisma validate
git diff --check
```

Per Prisma, se necessario, impostare `DATABASE_URL=file:./prisma/migration.db`
solo nel processo di verifica e ripristinare l'eventuale valore precedente.
`validate` verifica lo schema, non applica migrazioni. Il comando TypeScript
senza `-p` non controlla i progetti referenziati dal `tsconfig.json` radice.
Build, suite automatica e test manuale DM/player verificano aspetti diversi:
consultare `docs/p1-manual-test-plan.md` e il runbook M3 prima di finalizzare.

Per diagnosi Codex: `codex --version` e `codex doctor --summary`.
Interpretare errori di autenticazione/rete rispetto all'ambiente che esegue
il comando: una CLI figlia nella sandbox non prova lo stato della sessione IDE.
Non includere credenziali, variabili segrete o file di autenticazione nei report.

Riferimenti: [configurazione ufficiale](https://learn.chatgpt.com/docs/config-file/config-reference),
[subagent](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[istruzioni AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

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
