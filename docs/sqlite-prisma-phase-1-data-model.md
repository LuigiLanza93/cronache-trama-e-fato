# Fase 1: Modello Dati Proposto per SQLite + Prisma

## Obiettivo della fase

Definire il modello dati iniziale per migrare dai JSON a SQLite + Prisma senza riscrivere tutta l'app in un solo passo.

La scelta guida e':

- normalizzare bene le entita' relazionali
- mantenere come JSON i payload complessi e variabili
- preservare facilmente le feature attuali
- lasciare aperta la strada a una normalizzazione piu' spinta in futuro

## Principio generale

Per la prima release DB:

- `User`, `ChatMessage`, `EncounterScenario`, `EncounterScenarioEntry` vengono modellati in modo relazionale
- `Character` e `Monster` mantengono un payload JSON completo per evitare una migrazione troppo aggressiva
- si duplicano nel record alcuni metadati utili per ricerca, ownership, filtri e routing

Questo approccio evita una soluzione mista a regime:

- il database diventa l'unica fonte runtime
- i JSON attuali servono solo per la migrazione iniziale

## Entita' da introdurre

### 1. User

Rappresenta gli utenti autenticati dell'app.

Campi proposti:

- `id`: string, primary key
- `username`: string, unique
- `displayName`: string
- `role`: enum `DM | PLAYER`
- `passwordSalt`: string
- `passwordHash`: string
- `mustChangePassword`: boolean
- `createdAt`: datetime
- `updatedAt`: datetime

Relazioni:

- un `User` puo' possedere piu' `Character`
- un `User` puo' aver creato piu' `Character`
- un `User` puo' inviare molti `ChatMessage`

Note:

- l'ownership oggi sta in `character-ownership.json`; nel nuovo schema diventa una relazione diretta
- il ruolo resta semplice: `DM` oppure `PLAYER`

### 2. Character

Rappresenta una scheda personaggio o PNG.

Campi proposti:

- `id`: string, primary key
- `slug`: string, unique
- `name`: string
- `characterType`: enum `PG | PNG`
- `ownerUserId`: string nullable
- `createdByUserId`: string nullable
- `className`: string nullable
- `race`: string nullable
- `alignment`: string nullable
- `background`: string nullable
- `level`: int nullable
- `portraitUrl`: string nullable
- `archivedAt`: datetime nullable
- `data`: JSON
- `createdAt`: datetime
- `updatedAt`: datetime

Relazioni:

- `owner`: utente a cui la scheda e' associata
- `createdBy`: utente che ha creato la scheda
- `messages`: messaggi di chat legati a quella scheda

Decisione chiave:

Il contenuto completo della scheda va in `data` come JSON.

Dentro `data` finiscono, almeno nella prima release:

- `basicInfo`
- `abilityScores`
- `combatStats`
- `proficiencies`
- `equipment`
- eventuali altre sezioni della scheda

Perche' questa scelta:

- la scheda ha molti campi e puo' evolversi ancora
- il frontend oggi ragiona gia' su un oggetto complesso
- normalizzarla tutta subito aumenterebbe molto il rischio della migrazione

Metadati duplicati fuori da `data`:

- `name`
- `characterType`
- `className`
- `race`
- `alignment`
- `background`
- `level`
- `portraitUrl`

Servono per:

- home player
- roster DM
- gestione schede
- query e filtri futuri

### 3. Monster

Rappresenta una voce del bestiario, sia estratta sia custom.

Campi proposti:

- `id`: string, primary key
- `slug`: string, unique
- `name`: string
- `sourceType`: enum `SRD | CUSTOM`
- `sourceFile`: string nullable
- `challengeRatingDisplay`: string nullable
- `challengeRatingDecimal`: float nullable
- `challengeRatingXp`: int nullable
- `size`: string nullable
- `creatureType`: string nullable
- `alignment`: string nullable
- `data`: JSON
- `createdAt`: datetime
- `updatedAt`: datetime

Decisione chiave:

Anche qui il dettaglio completo del mostro va in `data` JSON nella prima release.

Dentro `data` restano:

- `general`
- `combat`
- `abilities`
- `details`
- `traits`
- `actions`
- `bonusActions`
- `reactions`
- `legendaryActions`
- `lairActions`
- `regionalEffects`
- `notes`
- `source`

Metadati duplicati fuori da `data`:

- `name`
- `slug`
- `sourceType`
- `challengeRatingDisplay`
- `challengeRatingDecimal`
- `challengeRatingXp`
- `size`
- `creatureType`
- `alignment`

Servono per:

- elenco bestiario
- filtri
- tracker iniziativa
- duplicazione mostri

### 4. ChatMessage

Rappresenta un singolo messaggio della chat DM <-> personaggio.

Campi proposti:

- `id`: string, primary key
- `characterId`: string
- `senderUserId`: string nullable
- `senderRole`: enum `DM | PLAYER | SYSTEM`
- `text`: string
- `createdAt`: datetime

Relazioni:

- ogni messaggio appartiene a un `Character`
- un messaggio puo' avere un `senderUserId`

Note:

- non serve una tabella `ChatThread` separata nella prima release: il thread e' implicito nel `characterId`
- se in futuro servira' una chat DM <-> User, si potra' estendere

### 5. EncounterScenario

Rappresenta uno scenario salvato per il tracker iniziativa.

Campi proposti:

- `id`: string, primary key
- `name`: string
- `createdByUserId`: string nullable
- `createdAt`: datetime
- `updatedAt`: datetime

Relazioni:

- uno scenario ha molte `EncounterScenarioEntry`
- opzionalmente uno scenario puo' avere l'utente creatore

### 6. EncounterScenarioEntry

Rappresenta una singola entry dentro uno scenario.

Campi proposti:

- `id`: string, primary key
- `scenarioId`: string
- `entryType`: enum `BESTIARY | MANUAL`
- `sortOrder`: int
- `monsterId`: string nullable
- `name`: string
- `count`: int
- `armorClass`: int nullable
- `hitPoints`: int nullable
- `powerTag`: enum nullable `DEBOLISSIMO | DEBOLE | FORTE | FORTISSIMO`
- `createdAt`: datetime
- `updatedAt`: datetime

Uso:

- se `entryType = BESTIARY`, `monsterId` punta a `Monster`
- se `entryType = MANUAL`, si usano `name`, `armorClass`, `hitPoints`

Note:

- `powerTag` resta un campo separato, non modifica mai il nome del mostro
- `sortOrder` aiuta a preservare l'ordine salvato

## Entita' che per ora NON introduciamo

### Session

Per la prima fase possiamo ancora lasciare le sessioni fuori dal DB, se vogliamo migrare il cuore dei dati senza toccare subito tutto il sistema auth.

Alternativa:

- introdurre subito anche `Session` se vogliamo eliminare completamente gli store in memoria

Decisione consigliata:

- opzionale nella primissima migrazione
- da decidere in Fase 2 / Fase 3

### Presence realtime

La presence non va in tabella nella prima release.

Motivo:

- e' stato runtime/volatile
- non e' un dato persistente di dominio

## Enums consigliati

### UserRole

- `DM`
- `PLAYER`

### CharacterType

- `PG`
- `PNG`

### MonsterSourceType

- `SRD`
- `CUSTOM`

### ChatSenderRole

- `DM`
- `PLAYER`
- `SYSTEM`

### EncounterScenarioEntryType

- `BESTIARY`
- `MANUAL`

### MonsterPowerTag

- `DEBOLISSIMO`
- `DEBOLE`
- `FORTE`
- `FORTISSIMO`

## Schema Prisma Concettuale

Schema ancora non definitivo, ma questa e' la direzione:

```prisma
model User {
  id                 String      @id
  username           String      @unique
  displayName        String
  role               UserRole
  passwordSalt       String
  passwordHash       String
  mustChangePassword Boolean     @default(false)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  ownedCharacters    Character[] @relation("CharacterOwner")
  createdCharacters  Character[] @relation("CharacterCreator")
  sentMessages       ChatMessage[]
  scenarios          EncounterScenario[]
}

model Character {
  id              String        @id
  slug            String        @unique
  name            String
  characterType   CharacterType
  ownerUserId     String?
  createdByUserId String?
  className       String?
  race            String?
  alignment       String?
  background      String?
  level           Int?
  portraitUrl     String?
  archivedAt      DateTime?
  data            Json
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  owner           User?         @relation("CharacterOwner", fields: [ownerUserId], references: [id])
  createdBy       User?         @relation("CharacterCreator", fields: [createdByUserId], references: [id])
  messages        ChatMessage[]
}

model Monster {
  id                     String             @id
  slug                   String             @unique
  name                   String
  sourceType             MonsterSourceType
  sourceFile             String?
  challengeRatingDisplay String?
  challengeRatingDecimal Float?
  challengeRatingXp      Int?
  size                   String?
  creatureType           String?
  alignment              String?
  data                   Json
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  scenarioEntries        EncounterScenarioEntry[]
}

model ChatMessage {
  id           String         @id
  characterId  String
  senderUserId String?
  senderRole   ChatSenderRole
  text         String
  createdAt    DateTime       @default(now())

  character    Character      @relation(fields: [characterId], references: [id])
  senderUser   User?          @relation(fields: [senderUserId], references: [id])
}

model EncounterScenario {
  id              String                   @id
  name            String
  createdByUserId String?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  createdBy       User?                    @relation(fields: [createdByUserId], references: [id])
  entries         EncounterScenarioEntry[]
}

model EncounterScenarioEntry {
  id         String                     @id
  scenarioId String
  entryType  EncounterScenarioEntryType
  sortOrder  Int
  monsterId  String?
  name       String
  count      Int
  armorClass Int?
  hitPoints  Int?
  powerTag   MonsterPowerTag?
  createdAt  DateTime                   @default(now())
  updatedAt  DateTime                   @updatedAt

  scenario   EncounterScenario          @relation(fields: [scenarioId], references: [id])
  monster    Monster?                   @relation(fields: [monsterId], references: [id])
}
```

## Decisioni Chiave Approvate da questa proposta

1. `Character` e `Monster` mantengono un payload `Json` nella prima release DB.
2. Ownership dei personaggi non vive piu' in una struttura separata: diventa una relazione diretta.
3. Le chat diventano messaggi normalizzati.
4. Gli scenari diventano tabelle vere con righe collegate.
5. Il suffisso di potenza del mostro resta un campo separato dal nome.

## Punti da confermare prima della Fase 2

1. Vogliamo tenere anche le sessioni nel DB fin da subito oppure no?
2. `Character.id` e `Monster.id` devono restare stringhe leggibili oppure passiamo a `cuid()`/UUID?
3. Per i mostri custom vogliamo distinguere anche il proprietario o per ora no?
4. `archivedAt` sulle schede basta, oppure vogliamo una tabella archivio separata?

## Prossimo Passo

Se questa proposta ti convince, il prossimo step e':

- inizializzare Prisma
- creare `schema.prisma`
- tradurre questo modello in schema reale
