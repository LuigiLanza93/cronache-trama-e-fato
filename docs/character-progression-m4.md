# Progressione personaggio M4: persistenza e storico

Stato: implementazione e migrazione applicate e collaudate sul database locale di sviluppo; modifiche non ancora consolidate su `dev` e mai applicate a Railway.

## Scopo

M4 rende persistibile il comando autorevole di progressione introdotto dalle API `preview/apply`. La nuova tabella `CharacterLevelHistory` registra soltanto operazioni concluse con successo e svolge anche la funzione di receipt durevole per i retry: lo storico non scade e non usa il contenitore temporaneo `AppState`.

La migrazione e additiva. Non modifica ne ricostruisce `Character`, `CharacterProgression` o `CharacterClass`, non inventa eventi per i livelli legacy e mantiene l'indice temporaneo `CharacterClass_m3_single_class_key`. La rimozione di quell'unico indice appartiene a MC1, quando il servizio consentira una seconda classe.

## Contratto persistito

Ogni riga di `CharacterLevelHistory` conserva:

- identita server dell'operazione, `requestId` client e firma SHA-256 del comando normalizzato;
- modalita `INCREMENT_EXISTING` o `ADD_NEW_CLASS`, classe bersaglio e sottoclasse opzionale;
- livello di classe, livello totale, revisione progressione e revisione `Character` prima/dopo;
- ruleset e versione della policy usata;
- snapshot JSON della richiesta, stato precedente, stato risultante, regole, risposta e autore;
- motivazione opzionale dell'override DM;
- campi nullable gia riservati a M5 per Dado Vita, metodo PF, PF ottenuti e modificatore di Costituzione;
- autore relazionale opzionale e snapshot immutabile dell'autore, cosi la provenienza resta leggibile anche se l'utente viene rimosso.

Le coppie `(characterId, requestId)` e `(characterId, progressionRevisionAfter)` sono uniche. Un retry con lo stesso `requestId` e la stessa firma deve restituire `resultSnapshot` senza riscrivere; una firma diversa deve produrre `REQUEST_ID_REUSED`.

Lo schema accetta gia `ADD_NEW_CLASS`, ma M4 deve rifiutarlo nel servizio applicativo. In questo modo MC1 estendera lo stesso contratto senza migrare lo storico precedente.

## Contratto REST M4

Gli endpoint sono accessibili esclusivamente al DM:

```text
POST /api/dm/characters/:slug/progression/preview
POST /api/dm/characters/:slug/progression/apply
```

La preview accetta `targetClassKey`, `targetSubclassKey` opzionale e, quando disponibili, `expectedRevision` e `expectedProgressionRevision`. Omettere `targetSubclassKey` conserva la scelta esistente; `null` dichiara esplicitamente nessuna scelta.

L'apply richiede sempre:

```json
{
  "requestId": "uuid-client-8-128-caratteri",
  "targetClassKey": "fighter",
  "targetSubclassKey": "champion",
  "expectedRevision": "2026-09-22T10:00:00.000Z",
  "expectedProgressionRevision": 0
}
```

Entrambe le revisioni sono precondizioni obbligatorie dell'apply. Il server ricalcola la preview dentro la coda per slug e non applica mai lo snapshot inviato dal client. M4 accetta soltanto un PG con una singola classe e `targetClassKey` coincidente con quella posseduta; `ADD_NEW_CLASS` resta `MULTICLASS_NOT_ENABLED` fino a MC1.

La risposta espone `revision`, `progressionRevision`, `preview`, `deferredEffects`, l'operazione applicata e la proiezione pubblica del personaggio. Le letture REST e realtime aggiungono `classes[]`, `primaryClass`, `totalLevel`, `progressionRevision` e `progressionStatus`, mantenendo `basicInfo.class/level` come proiezioni legacy. Se M3 e leggibile ma M4 non e ancora migrato, le letture continuano a funzionare e gli endpoint di progressione rispondono `503 PROGRESSION_SCHEMA_NOT_READY`.

Errori principali: `REVISION_CONFLICT`, `PROGRESSION_REVISION_CONFLICT`, `REQUEST_ID_REUSED`, `SUBCLASS_REQUIRED`, `INVALID_SUBCLASS`, `CHARACTER_LEVEL_LIMIT`, `CHARACTER_TYPE_UNSUPPORTED`, `MULTICLASS_NOT_ENABLED` e `PROGRESSION_UNAVAILABLE`.

## Vincoli SQLite

La migrazione SQL aggiunge controlli per:

- firma SHA-256 esadecimale minuscola;
- incremento esatto di un livello totale e di una revisione;
- coerenza dei livelli prima/dopo per classe esistente o nuova classe;
- snapshot JSON validi;
- chiave classe coerente con `ClassRule`;
- sottoclasse appartenente alla classe bersaglio;
- somma dei livelli `CharacterClass` non superiore a 20, anche dopo la futura rimozione del vincolo monoclasse.

CHECK, trigger e indice parziale della classe primaria non sono rappresentabili integralmente nello schema Prisma. `prisma/schema.prisma` resta la fonte del modello relazionale, mentre `migration.sql` e i test DB sono la fonte dei vincoli SQLite aggiuntivi.

## Procedura locale

Il comando predefinito e un dry-run in sola lettura:

```powershell
node scripts/apply-character-progression-m4.mjs --dry-run
```

Applicazione esplicita al database locale di sviluppo:

```powershell
node scripts/apply-character-progression-m4.mjs --apply
```

Lo script richiede uno schema M3 completo, verifica che ogni personaggio abbia una progressione `BACKFILLED` senza issue e una sola classe primaria, quindi:

1. acquisisce `BEGIN IMMEDIATE`;
2. applica `20260921_character_progression_m4/migration.sql`;
3. verifica colonne, indici e trigger richiesti;
4. conferma che i dati M3 non siano cambiati;
5. esegue `integrity_check`;
6. confronta `foreign_key_check` prima/dopo e rifiuta soltanto nuove violazioni;
7. esegue il commit.

La riesecuzione e idempotente. Uno schema M4 parziale viene rifiutato invece di essere considerato valido. Un dry-run con progressioni irrisolte restituisce exit code `2`; un apply le rifiuta con exit code `1` e non apre una migrazione parziale.

## Confine transazionale dell'API

L'implementazione server deve serializzare l'apply nella stessa coda per slug usata dalle altre mutazioni. Dentro una sola transazione SQLite deve:

1. cercare una receipt esistente prima di valutare revisioni mutabili;
2. ricalcolare la preview sullo stato corrente;
3. aggiornare `CharacterClass` e la sua provenienza;
4. incrementare con compare-and-swap `CharacterProgression.revision` e aggiornare `legacySnapshot`;
5. aggiornare insieme `Character.className`, `Character.level`, `data.basicInfo.class` e `data.basicInfo.level`;
6. inserire storico e risultato della receipt.

Una qualunque eccezione deve lasciare tutte le strutture allo stato precedente. `legacySnapshot` deve descrivere la nuova proiezione dopo ogni apply, altrimenti il dual-read M3 rileva una falsa divergenza e torna al legacy.

Le patch generiche devono rifiutare modifiche dirette sia a `basicInfo.class` sia a `basicInfo.level`. Anche la creazione di un nuovo personaggio deve creare atomicamente `CharacterProgression` e `CharacterClass`; in caso contrario il personaggio nascerebbe fuori dal writer autorevole.

## Verifica

Test DB mirato:

```powershell
npx.cmd vitest run tests/database/character-progression-m4.test.mjs
```

Validazione Prisma:

```powershell
$env:DATABASE_URL='file:./prisma/migration.db'
npx.cmd prisma validate
```

I test coprono dry-run read-only, prima applicazione, riesecuzione, schema parziale, progressioni M3 irrisolte, unicita delle receipt, sequenze di livello/revisione, snapshot JSON, ownership di classe/sottoclasse, limite totale 20, conservazione delle violazioni FK preesistenti e guardia produzione.

## Produzione Railway

M4 non deve essere applicato a `/data/migration.db` durante lo sviluppo. Un rilascio futuro deve eseguire nell'ordine:

1. backup Railway fresco e verificato;
2. M3 schema, catalogo e backfill;
3. verifica che non esistano progressioni `UNRESOLVED`;
4. M4 schema e vincoli;
5. deploy dello stesso codice `main` compatibile;
6. `integrity_check`, `foreign_key_check`, conteggi storico e smoke test DM/player.

L'applicazione a `/data/migration.db` richiede entrambe le guardie `--allow-production` e `--backup-verified`, oltre all'autorizzazione esplicita al rilascio. Non usare `prisma db push` su Railway. Il rollback applicativo puo disabilitare gli endpoint M4 senza cancellare la tabella; un rollback dei dati resta manuale e parte dal backup pre-migrazione.
