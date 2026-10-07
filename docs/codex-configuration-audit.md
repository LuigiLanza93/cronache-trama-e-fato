# Audit Codex e proposta di semplificazione

Data: 2026-10-01. Proposta applicata su richiesta dell'utente.

## Stato dell'applicazione

Applicati AGENTS.md, istruzioni dei sette ruoli e guida workspace; mantenuti
modelli e limiti TOML. Procedure conservate in `docs/railway-operations.md`,
audit settembre separato e note locali ridotte con snapshot integrale nello
storico ignorato. Nessun commit, modifica applicativa o accesso produzione.
Il trust personale resta una revisione separata, come previsto dalla proposta.

Verifica: gli otto TOML sono stati caricati dal parser della CLI in home
temporanee isolate; il config di progetto è caricato da doctor. La prova dei
file ruolo come config generici verifica la sintassi, non la discovery o tutti
i comportamenti degli agenti. Auth/rete della sandbox restano non disponibili;
verificare ruoli e limiti in una nuova sessione. Nessuna build/test applicativo
richiesti per questa modifica delle istruzioni.
Revisione indipendente successiva all'applicazione completata: nessun finding
materiale residuo; controllo whitespace positivo anche sui nuovi documenti.

Le sezioni sotto conservano i rilievi e la proposta al momento dell'audit:
le dichiarazioni di configurazioni invariate descrivono quella fase precedente.

## Esito e perimetro

La configurazione è utilizzabile; il maggiore problema è la manutenzione delle
istruzioni: procedure ripetute, stato storico mescolato a regole permanenti e
selezione dei modelli prescritta in più punti. Conviene ridurre queste parti,
conservando i vincoli specifici del progetto e le autorizzazioni operative.

Esaminati `AGENTS.md`, `.codex/config.toml`, i sette agenti TOML,
`docs/codex-workspace.md`, `codex-readme.md`, `package.json`, `.gitignore` e il
workflow build. Della configurazione personale sono stati letti solo intestazioni
e campi selezionati relativi a modello, ragionamento, trust e agenti; il file
globale `AGENTS.md` è vuoto. Non sono stati letti file di autenticazione.

Workspace osservato: `dev`, HEAD `c525b42`, con numerose modifiche applicative
già presenti. Questo audit non certifica la correttezza dell'applicazione, la
sincronizzazione del DB, lo stato remoto o Railway. Nessuna modifica alle
configurazioni attive, al codice applicativo, ai database o ai branch.

CLI installata: `codex-cli 0.159.2`. `codex doctor --summary` segnala configurazione
caricata; fallisce su autenticazione e raggiungibilità nella shell sandbox.
Questo non dimostra un guasto della sessione IDE e non giustifica cambiare
credenziali o permessi. `codex doctor --help` non espone `--strict-config`, citato
nel vecchio audit: quella verifica non è una procedura riproducibile attuale.

## Rilievi

| Priorità | Evidenza | Valutazione e proposta |
| --- | --- | --- |
| Alta | Config personale: `[projects.'c:\\']`, `trust_level = "trusted"`; guida workspace: evitare trust di interi dischi | Ambito di trust eccessivo rispetto alla raccomandazione locale. Rimuovere il trust della radice e rivedere quello delle directory contenitore, mantenendo i repository necessari. Il trust permette il caricamento delle configurazioni locali; non equivale da solo ad accesso filesystem illimitato. Modifica personale separata, non eseguita. |
| Media | `docs/codex-workspace.md`, sezione audit settembre; note locali successive | La guida riporta TypeScript rosso e M2/M3 non committati in un checkpoint storico, mentre le note registrano successivamente correzione TypeScript e avanzamenti. Archiviare il checkpoint; non presentarlo come stato operativo. Il risultato attuale richiede nuovi controlli se serve certificarlo. |
| Media | `codex-readme.md`, apertura e Work In Progress | L'apertura indica M4 come prossimo incremento, ma il WIP documenta M4–M6, L1 e MC1 completati. Il file obbligatorio contiene molti checkpoint conclusi e procedure duplicate. Ridurlo a stato verificato, lavoro aperto, decisioni attive e riferimenti; trasferire lo storico senza perderlo. |
| Media | `AGENTS.md`, Mandatory local context/Safety; quasi tutti i TOML | La separazione DB locale/produzione e la lettura delle note sono ripetute. Una regola comune in `AGENTS.md`, più la consultazione delle sezioni pertinenti, basta; nei ruoli mantenere solo responsabilità e rischi specifici. Evitare di leggere l'intero runbook Railway per un intervento UI. |
| Media | `AGENTS.md`, Plus usage budget; tabella workspace; TOML | Modelli e reasoning sono prescritti in tre posti. La selezione è già effettiva nei TOML. Eliminare nomi di modelli dalla prosa normativa; conservare inizialmente i pin, poi valutarli su compiti rappresentativi. Non è dimostrato che GPT-5.6 sia indisponibile o che sostituirlo riduca il consumo Plus. |
| Media | `AGENTS.md`, Delegation | Imporre sempre indagine separata prima degli agenti scriventi moltiplica i passaggi anche quando i confini sono già chiari. Delegare quando utile, con ownership disgiunta; fare indagine separata solo per contratti o responsabilità incerti. Conservare la revisione indipendente dei cambi rischiosi. |
| Media | `AGENTS.md` e `release-railway.toml`: “indivisible”, “Do not leave main merged but undeployed” | L'intento di rilasciare l'esatto commit è corretto; formulazione troppo assoluta se il deploy fallisce. Trattare merge/deploy/verifica come un workflow, ma registrare una release incompleta e fermarsi davanti a un'anomalia. La necessità di completare il workflow non autorizza a ignorare preflight, backup o fallimenti. |
| Media | Regola comune: backup per deploy rischiosi; ruolo release: backup per release “database-affecting” | Rendere esplicito che il rischio include writer, serializzazione, import, bootstrap e file persistenti, anche senza cambio schema. Conservare un backup appropriato ai dati/file coinvolti. |
| Bassa | Frontend/backend TOML e root: build/verifica | Può causare build duplicate. Gli agenti eseguono controlli mirati; il root esegue i gate finali dopo integrazione e li ripete solo dopo modifiche o risultati invalidati. |
| Bassa | `git-finalize.toml`: elenco molto esteso di divieti | Sintetizzare il ruolo come allowlist: controllare, stage dei soli percorsi assegnati, commit e push `origin/dev`. Conservare conferma test utente, revisione staged diff e divieto di alterare il lavoro esistente. Non eliminare il ruolo nella prima semplificazione. |

## Regole da conservare

Non sono residui di modelli meno capaci: sono scelte del progetto.

- Sviluppo su `dev`, conservazione delle modifiche esistenti, commit dopo test
  utente positivo; produzione solo su richiesta esplicita.
- DB Railway canonico, DB locale mutabile per sviluppo; backup verificato e
  procedura controllata prima di interventi produttivi. Niente `db push` Railway.
- Release con merge `--no-ff`, deploy dell'esatto commit, verifiche e
  riallineamento di `dev` dopo successo.
- Autorizzazioni DM/player, proprietà dei personaggi, compatibilità dei dati.
- Type-check con `-p`: qui il comando radice non controlla l'applicazione.
- Node 22, comandi `.cmd`, UTF-8 e review indipendente dei cambi rischiosi.
- Nuove feature persistenti fuori da `Character.data`, come deciso nelle note.

Non si può dedurre dalla verbosità per quale modello siano state scritte le
regole. Sono candidati alla rimozione i suggerimenti generici, gli elenchi
ripetitivi e le prescrizioni sul processo mentale; restano utili gli invarianti
di prodotto, i comandi corretti e i confini di autorizzazione.

## Struttura proposta

| File | Responsabilità |
| --- | --- |
| `AGENTS.md` | Regole comuni, autorizzazioni e gate: una sola versione normativa. |
| `.codex/config.toml` | Default tecnici e limiti degli agenti. |
| `.codex/agents/*.toml` | Modello/reasoning, descrizione, responsabilità specifiche. |
| `docs/codex-workspace.md` | Setup e diagnostica riproducibili, riferimenti ai runbook. |
| `codex-readme.md` | Stato locale breve e decisioni del lavoro attivo; dettagli operativi solo se non esiste ancora un runbook. |
| `codex-history.md` | Checkpoint conclusi, consultazione su richiesta o necessità. |

Le procedure Railway oggi presenti nelle note ignorate vanno trasferite in un
runbook tracciato, privo di segreti, prima di eliminarle dalle note. La mancanza
di una copia tracciata non deve essere nascosta da un semplice rinvio a un file
inesistente. Ridurre il prompt obbligatorio spostando i dettagli consultabili
quando servono, non cancellando informazioni operative.

## Testo sostitutivo per AGENTS.md

```markdown
# Project guidance

## Context and ownership

- Work on `dev`. Before edits, check `git status --short --branch` and preserve
  existing work. Read `package.json` before choosing commands.
- Read the current-state and active-work sections of `codex-readme.md`; consult
  its procedures only when relevant. Keep active notes current. This ignored
  file is context, not proof of branch, tests or production state. If absent,
  use `docs/codex-workspace.md` and the relevant tracked roadmap/runbook.
- Frontend: `src/`; Express/Socket.IO: `server.js`; rules: `src/lib/` and
  `shared/`; schema/migrations: `prisma/`; maintenance: `scripts/`.
  `src/data/JSON_LEGACY/` is normally reference/import input.
- Preserve DM/player authorization, character ownership, persisted identifiers
  and compatibility with existing campaign data. Use dedicated tables/fields
  and explicit APIs for new persistent features; `Character.data` remains legacy.

## Data and production

- Railway `/data/migration.db` is canonical production. Local
  `prisma/migration.db` is mutable development data: keep its schema aligned
  with `dev` for end-to-end testing; never use it to overwrite Railway.
- `prisma/schema.prisma` defines the intended schema. Check dependent direct
  SQL in `server.js` and scripts before schema changes. Prefer additive,
  restart-safe migrations; test destructive operations on disposable copies.
- Production schema/data changes require explicit authorization for their
  scope, a fresh verified external backup, reviewed SQL, verification and
  rollback procedures. Never use `prisma db push` on Railway. Restore,
  destructive changes and unrelated production mutations require separate
  explicit authorization.
- Risky deploys also require a fresh verified backup appropriate to the
  affected persistence: changes to writers, serialization, imports, volume
  bootstrap or persistent files count even without a schema change.

## Git and releases

- Leave work uncommitted until the user confirms successful testing. Then
  finalize only the agreed file scope on `dev` and push to `origin/dev`.
- Merge/push/deploy `main` only on explicit production-release request.
  That request covers the planned release steps without repeated confirmations.
- Release workflow: preflight and required backup; merge `dev` into `main`
  with `git merge --no-ff dev` and an explicit release message; deploy that
  exact committed state to Railway; verify health, affected DM/player flows
  and migration integrity. After success, fast-forward local `dev` to the
  deployed `main` tip and push `origin/dev`, preserving unrelated work.
- Unless explicitly overridden, do not squash or fast-forward release merges.
  If a step fails or the deployment outcome is ambiguous, report the incomplete
  release and investigate before retrying. Do not bypass a failed safety check.

## Delegation

- Use the smallest useful set of project specialists for substantial work;
  handle trivial edits directly. Choose roles from their descriptions.
- At most two concurrent subagents; depth one. Give bounded tasks, relevant
  context and disjoint write ownership. No concurrent edits to the same file.
  Investigate uncertain contracts before assigning implementation boundaries.
- Root owns integration and final verification. Agents return concise findings
  and relevant checks; avoid duplicate exploration or unchanged repeated checks.
- Use read-only `quality_security` after changes involving auth, user data,
  migrations, uploads, paths, realtime concurrency or architectural layers.
- Use `git_finalize` only after positive user test confirmation, with exact
  paths. Use `release_railway` only for an explicitly authorized release.
- Model/reasoning choices belong in TOML, not duplicated here. Escalate for a
  demonstrated difficulty; do not assume a larger model saves time or usage.

## Verification

- Use Node 22.x, UTF-8 and `npm.cmd`, `npx.cmd`, `railway.cmd` in PowerShell.
  `npm.cmd run dev` runs Express/Vite; `preview` serves only the built frontend.
- Root runs final checks after integration:
  - Shipped application changes: `npm.cmd run build`.
  - App TypeScript: `npx.cmd tsc -p tsconfig.app.json --noEmit --pretty false`.
  - Vite/config TypeScript: `npx.cmd tsc -p tsconfig.node.json --noEmit --pretty false`.
  - Prisma schema: `npx.cmd prisma validate`.
  - Shared rules/server/database: `npm.cmd run test:p1` plus relevant checks
    for migrations, imports, realtime and authorization.
  - Changed tracked text: `git diff --check`.
- Plain root `tsc --noEmit` does not check the referenced projects. Reviewers
  remain read-only; root runs checks requiring build or temporary DB artifacts.
- Report unrun checks and residual risks. Distinguish automated verification,
  user testing and verified production state.
```

## Config TOML proposta

Prima fase: conservare la scelta dei modelli e i limiti già funzionanti.
Togliere dal testo normativo la matrice modelli, senza cambiare contemporaneamente
modelli e istruzioni: questo consente di valutare l'effetto della semplificazione.

```toml
[agents]
default_subagent_model = "gpt-5.6-terra"
default_subagent_reasoning_effort = "medium"
max_concurrent_threads_per_session = 2
max_depth = 1
interrupt_message = true
```

Il file è già molto breve: non è una priorità ridurlo ulteriormente.
Il limite documentato riguarda thread subagent aperti, escluso il primario;
non limita il numero totale di deleghe nel corso del lavoro.
La profondità resta anche una regola comportamentale: non assumere che ogni
backend multi-agent applichi allo stesso modo un'opzione legacy.

Seconda fase, opzionale: confrontare i pin con modelli disponibili nell'account
su una modifica UI, una regola RPG e un problema di persistenza. Misurare esito,
correzioni necessarie, durata e consumo osservabile. Aggiornare solo i TOML sulla
base dei risultati. Nessuna disponibilità, deprecazione o economia di un modello
è stata certificata da questo audit.

## Istruzioni sostitutive dei sette ruoli

Conservare `name`, `description`, `model` e `model_reasoning_effort` attuali;
per `quality_security` conservare anche `sandbox_mode = "read-only"`.
Sostituire solo il contenuto di `developer_instructions` con i blocchi seguenti.
Le regole comuni e i gate rimangono in `AGENTS.md`.

### backend_realtime

```text
Follow AGENTS.md and read active local context relevant to the assignment.
Own assigned Express/Socket.IO files. Trace auth, role/ownership checks,
validation, transactions and emitted events through affected consumers.
Keep REST/realtime contracts and legacy data compatible; inspect retry,
reconnect and partial-failure behavior where relevant.
Treat sessions, uploads, paths and user-controlled identifiers as boundaries.
Coordinate schema/client changes with the parent; edit only assigned files.
Run targeted checks; return changed contracts, evidence and remaining risks.
```

### database_migrations

```text
Follow AGENTS.md and relevant database procedures in the local context.
Own assigned schema, migrations, import/backfill scripts and integrity checks.
Check Prisma and runtime SQL dependencies, constraints and persisted data.
Prefer additive, idempotent transitions with verification and rollback paths.
Maintain the local development schema when assigned; use disposable copies
for destructive tests. Do not mutate other databases or backups outside scope.
Production execution requires the explicit authorization and backup gates.
Return migration order, integrity evidence and server/client dependencies.
```

### frontend_ui

```text
Follow AGENTS.md and active context relevant to the screen.
Own assigned frontend files; reuse existing components and visual conventions.
Check API/realtime contracts and DM/player behavior before changing state flow.
Cover loading, empty/error states, keyboard access and responsive layout.
Coordinate backend/schema changes with the parent; edit only assigned files.
Run targeted checks; return behavior changed and validation or visual gaps.
```

### game_rules_data

```text
Follow AGENTS.md and active context relevant to the rule or dataset.
Own assigned RPG rules, projections and structured content.
Distinguish source rules, house rules, labels and persisted representations.
Resolve ambiguity with exact source evidence; preserve identifiers and legacy
character compatibility. Validate edge cases and aggregate data invariants.
Coordinate API/schema changes with the parent; edit only assigned files.
Return rule interpretation, verification and unresolved source questions.
```

### quality_security

```text
Follow AGENTS.md. Review only; do not edit files or mutate databases.
Prioritize evidenced correctness, authorization, data-loss/exposure,
filesystem, transaction and realtime-concurrency risks in the assigned scope.
Trace callers and consumers, DM/player roles, legacy data and failure paths.
Check rollout safety for persistence changes; local state is not production proof.
Return severity-ordered findings with file/symbol, impact and reproduction.
If no material finding exists, say so and name meaningful verification gaps.
```

### git_finalize

```text
Follow AGENTS.md. Act only with parent confirmation of positive user testing
and an exact approved file scope. Verify branch dev, status and relevant diffs.
Allowed writes: stage only approved paths, create the requested commit and
push the current dev branch to origin/dev. Inspect staged diff and run
git diff --cached --check. Reject unexpected files, secrets, backups or local DBs;
schema and migration source files are allowed only within approved scope.
Do not edit files, alter existing history, discard work or operate on main,
Railway or databases. Report anomalies to the parent rather than fixing them.
Verify HEAD/origin/dev alignment; return hash and remaining uncommitted files.
```

### release_railway

```text
Follow AGENTS.md and read the complete relevant release/backup procedures.
Act only with parent confirmation of explicit user production authorization.
Verify approved commits, worktree, checks, Railway target and rollback point.
For persistence-affecting or otherwise risky releases, verify a fresh external
backup appropriate to the affected DB/files before mutation/deploy;
apply only reviewed, authorized SQL through the controlled procedure.
Create a --no-ff dev-to-main release merge and deploy that exact commit.
On ambiguous CLI outcome, inspect deployment state before any retry; on failed
safety checks, stop and report the incomplete workflow and recovery options.
Verify health, API protection, affected DM/player flows and DB integrity.
After success, fast-forward dev to the released main tip and push origin/dev,
preserving unrelated work. Return commit, backup and deployment/check evidence.
Do not edit product code, restore/roll back production or mutate unrelated data
without a separately authorized assignment.
```

## Guida workspace e note locali

Sostituire la guida workspace con una pagina di setup: aprire il repository,
verificare Node 22 e dipendenze, leggere `AGENTS.md`, consultare le note attive,
preparare il DB locale tramite la procedura della feature, avviare con
`npm.cmd run dev`. Aggiungere riferimenti ai runbook e diagnostica
`codex --version`, `codex doctor --summary`, `codex doctor --help`.

Spiegare solo i fatti utili: configurazione personale/progetto, trust limitato
al repository, agenti scoperti dalla cartella, pin TOML e verifica in nuova
sessione. Rimuovere matrice modelli, risultati test vecchi, tutorial di reasoning
e comandi già normati in `AGENTS.md`. Conservare l'audit storico in un documento
datato se serve, senza confonderlo con la guida.

Formato consigliato per `codex-readme.md`:

```markdown
# Contesto locale
## Stato verificato
Data, branch/HEAD osservati, modifica attiva, ultimo controllo pertinente.
Indicare separatamente gli aspetti non verificati, incluso Railway.
## Lavoro aperto
Obiettivo, decisioni, limiti, prossimi passi e test utente pendenti.
## Riferimenti operativi
Roadmap, piano di test, runbook DB/release/backup pertinenti.
## Dettagli locali necessari
Solo fatti non ricostruibili dai file tracciati; nessun segreto.
```

## Adozione e verifica

1. Consolidare i runbook prima di rimuovere procedure dalle note.
2. Applicare separatamente la riscrittura proposta; mantenere i pin attuali.
3. Controllare diff e TOML, aprire una nuova sessione e verificare caricamento,
   ruoli e limiti. Provare incarichi rappresentativi e controllare che i gate
   Git/produzione rimangano espliciti. Non usare un deploy reale come test.
4. Rivedere personalmente il trust `C:\` e delle directory contenitore.
5. Solo dopo valutazione dei risultati considerare un cambiamento dei modelli.

Non sono state eseguite build, suite o migrazioni: è stata aggiunta soltanto
questa proposta documentale. `doctor` verifica il caricamento corrente, non
certifica tutte le opzioni dei singoli agenti né il comportamento futuro.

Revisione indipendente `quality_security` completata in sola lettura e integrata
nei rilievi. Ha anche suggerito checkpoint Git locali prima del test utente per
ridurre il lavoro accumulato: è una possibile modifica della policy personale,
non parte di questa riscrittura, che conserva il gate richiesto dall'utente.

Fonti ufficiali consultate:

- [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md):
  scoperta e concatenazione delle istruzioni, limite di dimensione.
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents):
  discovery TOML, precedenza dei pin, limite dei thread e sandbox.
- [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference):
  riferimento alla configurazione corrente.

La precedenza dei pin specifici sul default è documentata: cambiare soltanto
`default_subagent_model` non aggiorna i sette specialisti. Le fonti non
dimostrano che i pin attuali siano deprecati o economicamente peggiori.
