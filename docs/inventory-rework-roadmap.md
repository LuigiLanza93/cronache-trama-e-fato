# Roadmap Rework Inventario

## Obiettivo

Rifondare l'inventario come sottosistema relazionale del database, evitando che la logica degli oggetti resti annegata nel JSON del personaggio.

Il rework deve preparare il terreno per:

- equipaggiamento a slot
- categorie oggetto con regole reali
- armi con attacchi strutturati
- bonus automatici da oggetti equipaggiati
- calcolo automatico della CA
- requisiti minimi di caratteristica per indossare alcuni oggetti
- passaggio di oggetti tra personaggi
- storico transazioni di oggetti e, in futuro, monete

## Principi guida

- il JSON del personaggio non deve piu' essere la fonte primaria per l'inventario
- le definizioni oggetto devono vivere come entita' autonome
- il possesso di un oggetto e la sua definizione devono essere separati
- stato corrente e storico devono essere modellati separatamente
- le regole di equipaggiamento devono derivare dai dati, non da logica hardcoded sparsa

## Stato attuale

L'inventario oggi e' ibrido:

- `equipment.attacks`
- `equipment.items`
- `equipment.equipment` legacy
- `equipment.coins`

Problemi principali:

- convivenza di formati legacy e nuovi
- armi e oggetti gestiti in strutture diverse
- equipaggiamento espresso come booleano, non come occupazione di slot
- attacchi in parte descrittivi e in parte strutturati
- bonus e CA non derivati dagli oggetti in modo sistematico

## Modello dati approvato

Le nuove entita' introdotte nello schema Prisma sono:

- `ItemDefinition`
- `CharacterItem`
- `ItemSlotRule`
- `CharacterItemEquip`
- `ItemAttack`
- `ItemModifier`
- `ItemFeature`
- `ItemAbilityRequirement`
- `InventoryTransaction`
- `InventoryTransactionItem`
- `InventoryTransactionCurrency`

### 1. ItemDefinition

Rappresenta il template di un oggetto.

Campi/concetti chiave:

- categoria
- sottocategoria
- rarita'
- equipaggiabile
- stackabile
- proprieta' armatura / arma / guanti
- attacchi
- modificatori
- feature speciali

### 2. CharacterItem

Rappresenta una specifica istanza posseduta da un personaggio.

Campi/concetti chiave:

- proprietario corrente
- riferimento alla definizione
- quantita'
- stato equipaggiato
- note / override locali

### 3. ItemSlotRule

Descrive dove e come un item puo' essere equipaggiato.

Campi/concetti chiave:

- `slot`
- `groupKey`
- `selectionMode`
- `sortOrder`

Uso:

- gruppi alternativi di equipaggiamento
- gruppi che richiedono tutti gli slot
- gruppi che richiedono un solo slot tra piu' alternative

### 4. CharacterItemEquip

Rappresenta gli slot effettivamente occupati da un item equipaggiato.

Serve a distinguere:

- un item equipaggiabile
- un item effettivamente equipaggiato
- il modo concreto in cui e' stato equipaggiato

### 5. ItemAttack

Rappresenta uno o piu' attacchi strutturati associati a un oggetto.

Campi/concetti chiave:

- tipo attacco
- bonus attacco
- dado danno
- tipo danno
- requisito di impugnatura
- gittata
- condizione testuale

### 6. ItemModifier

Rappresenta modificatori meccanici dichiarativi.

Esempi:

- bonus alla CA
- bonus a caratteristiche
- bonus a iniziativa
- bonus a PF massimi

### 7. ItemFeature

Rappresenta abilita' o effetti speciali non riducibili a un semplice modificatore numerico.

Supporta cadenze strutturate di utilizzo:

- `AT_WILL`
- `ENCOUNTER`
- `SHORT_REST`
- `LONG_REST`
- `DAILY`
- `CUSTOM`

Se la cadenza e' `CUSTOM`, il testo descrittivo vive in `customResetLabel`.

### 7.b ItemAbilityRequirement

Rappresenta un requisito minimo di caratteristica per indossare un oggetto.

Esempio:

- `STRENGTH >= 15`

### 7.c CharacterItemFeatureState

Rappresenta lo stato d'uso della feature sulla singola istanza posseduta.

Serve per distinguere:

- definizione della feature sull'oggetto
- usi effettivamente spesi da quel personaggio su quella specifica copia

Campi/concetti chiave:

- `usesSpent`
- `lastResetAt`

### 8. InventoryTransaction

Header di uno storico transazionale.

Serve per tracciare:

- trasferimenti
- loot
- acquisti
- vendite
- doni
- consumo
- distruzione

### 9. InventoryTransactionItem

Righe oggetto coinvolte in una transazione.

### 10. InventoryTransactionCurrency

Righe valuta coinvolte in una transazione.

Pensata per il supporto futuro alle monete con storico completo.

## Regole di equipaggiamento approvate

### Slot disponibili sul personaggio

- `HEAD`: 1 slot
- `BACK`: 1 slot
- `ARMOR`: 1 slot
- `GLOVE_LEFT`: 1 slot
- `GLOVE_RIGHT`: 1 slot
- `RING_1` ... `RING_10`: 10 slot
- `NECK`: 1 slot
- `FEET`: 1 slot
- `WEAPON_HAND_LEFT`: 1 slot
- `WEAPON_HAND_RIGHT`: 1 slot

Interpretazione:

- testa: 1 oggetto
- schiena: 1 oggetto
- armatura: 1 oggetto
- guanti: 2 slot separati, utilizzabili anche singolarmente
- anelli: 10 slot complessivi
- collana: 1 slot
- scarpe: 1 slot di coppia
- mani: 2 slot per armi / scudi / impugnatura

### Modalita' di selezione slot

Sono supportate due modalita':

- `ALL_REQUIRED`
- `ANY_ONE`

Uso tipico:

- `ALL_REQUIRED`: servono tutti gli slot del gruppo
- `ANY_ONE`: serve uno slot qualunque del gruppo

### Esempi approvati

- elmo: `HEAD`, `ALL_REQUIRED`
- armatura: `ARMOR`, `ALL_REQUIRED`
- collana: `NECK`, `ALL_REQUIRED`
- oggetto portato dietro la schiena: `BACK`, `ALL_REQUIRED`
- scarpe: `FEET`, `ALL_REQUIRED`
- guanti in coppia: `GLOVE_LEFT` + `GLOVE_RIGHT`, `ALL_REQUIRED`
- guanto singolo: uno tra `GLOVE_LEFT` o `GLOVE_RIGHT`
- anello: uno slot tra `RING_1` ... `RING_10`
- arma a una mano: una mano tra `WEAPON_HAND_LEFT` / `WEAPON_HAND_RIGHT`
- arma a due mani: entrambe le mani
- arma versatile: alternativa tra una mano oppure entrambe

## Regole approvate per armi

### Tipi di impugnatura

Le armi possono essere:

- `ONE_HANDED`
- `TWO_HANDED`
- `VERSATILE`

### Armi versatili

Le armi versatili possono essere equipaggiate:

- a una mano
- a due mani

Il danno cambia in base a come sono impugnate.

Per questo:

- non usiamo un solo campo descrittivo
- usiamo piu' `ItemAttack`
- ogni attacco dichiara il proprio `handRequirement`

Valori supportati:

- `ANY`
- `ONE_HANDED`
- `TWO_HANDED`

Esempio:

- attacco 1: `1d8`, `ONE_HANDED`
- attacco 2: `1d10`, `TWO_HANDED`

## Regole approvate per guanti

I guanti possono essere:

- `SINGLE`
- `PAIR`

Implicazioni:

- un guanto singolo occupa un solo slot mano-guanto
- un paio occupa entrambi gli slot guanto

## Regole approvate per armature e scudi

### Categorie armatura

Supportate:

- `LIGHT`
- `MEDIUM`
- `HEAVY`
- `SHIELD`

### Calcolo CA

Supportato tramite:

- `armorClassCalculation`
- `armorClassBase`
- `armorClassBonus`

Modalita' approvate:

- `BASE_PLUS_DEX`
- `BASE_PLUS_DEX_MAX_2`
- `BASE_ONLY`
- `BONUS_ONLY`

Interpretazione:

- leggere: `BASE_PLUS_DEX`
- medie: `BASE_PLUS_DEX_MAX_2`
- pesanti: `BASE_ONLY`
- scudi: `BONUS_ONLY`

### Regole attese v1

- una sola armatura puo' occupare `ARMOR`
- uno scudo aggiunge bonus CA
- uno scudo occupa una mano arma
- un'arma a 2 mani impedisce l'uso di uno scudo

## Regole applicative v1 approvate

### 1. canEquip

Un item puo' essere equipaggiato se esiste almeno un gruppo di slot compatibile con gli slot liberi.

Se ci sono piu' gruppi compatibili:

- il sistema puo' scegliere automaticamente il primo valido
- oppure chiedere una scelta esplicita all'utente

Per armi versatili e anelli, la scelta esplicita e' preferibile.

### 2. resolveEquippedAttacks

Gli attacchi disponibili di un item dipendono da:

- item equipaggiato o no
- slot effettivamente occupati
- `handRequirement`

### 3. calculateArmorClassFromEquipment

La CA finale deve essere derivata da:

- tipo di armatura equipaggiata
- base armatura
- modificatore DES, se previsto
- limite DES, se previsto
- bonus scudo
- altri `ItemModifier` su `ARMOR_CLASS`

## Storico transazioni approvato

Lo storico deve supportare da subito:

- passaggio oggetti tra personaggi
- passaggio oggetti verso NPC
- passaggio oggetti da NPC
- consumo / distruzione

E deve preparare il supporto futuro a:

- trasferimenti di monete verso player
- trasferimenti di monete verso NPC

Principio:

- `CharacterItem` rappresenta lo stato corrente
- `InventoryTransaction*` rappresenta lo storico

## Regole approvate per abilita' oggetto

Alcuni oggetti possono concedere abilita' con cadenza di utilizzo.

Esempi:

- a volonta'
- a incontro
- per riposo breve
- per riposo lungo
- giornaliere

Decisione approvata:

- la definizione dell'abilita' sta in `ItemFeature`
- lo stato d'uso per singolo oggetto/personaggio sta in `CharacterItemFeatureState`

Questo evita di confondere:

- "cosa puo' fare questo tipo di oggetto"
- "quante volte questa specifica copia e' gia' stata usata"

## Estensione proposta per consumabili e pozioni

La struttura attuale permette gia' di censire una pozione come:

- `category = CONSUMABLE`
- `stackable = true`
- `equippable = false`
- `CharacterItem.quantity` per la quantita'

Questa modellazione e' sufficiente per inventario e catalogo, ma resta debole sul piano meccanico:

- una pozione non e' un bonus permanente
- una pozione non e' un attacco
- una pozione non e' una feature a riposo

Serve quindi una modellazione esplicita degli effetti "all'uso".

### Obiettivo

Introdurre un livello minimo di struttura per effetti come:

- pozioni di cura
- veleni applicati o ingeriti
- consumabili offensivi
- pergamene / oggetti monouso

### Proposta minima: ItemUseEffect

Nuova entita' proposta:

- `ItemUseEffect`

Legata a:

- `ItemDefinition`

Scopo:

- descrivere cosa succede quando l'oggetto viene usato o consumato

Campi minimi proposti:

- `id`
- `itemDefinitionId`
- `effectType`
- `targetType`
- `diceExpression`
- `flatValue`
- `damageType`
- `savingThrowAbility`
- `savingThrowDc`
- `successOutcome`
- `durationText`
- `notes`
- `sortOrder`

### Enum minimi proposti

`ItemUseEffectType`

- `HEAL`
- `DAMAGE`
- `TEMP_HP`
- `APPLY_CONDITION`
- `REMOVE_CONDITION`
- `RESTORE_RESOURCE`
- `CUSTOM`

`ItemUseTargetType`

- `SELF`
- `CREATURE`
- `OBJECT`
- `AREA`
- `CUSTOM`

`ItemUseSuccessOutcome`

- `NONE`
- `HALF`
- `NEGATES`
- `CUSTOM`

### Esempio: Pozione di guarigione

`ItemDefinition`

- `name = Pozione di guarigione`
- `category = CONSUMABLE`
- `stackable = true`
- `equippable = false`

`ItemUseEffect`

- `effectType = HEAL`
- `targetType = CREATURE`
- `diceExpression = 2d4+2`
- `flatValue = null`
- `notes = Recupera punti ferita bevendo la pozione.`

### Esempio: Dardi avvelenati

L'attacco resta in `ItemAttack`, ma il rider del veleno in futuro potrebbe vivere in un effetto strutturato collegato all'uso o all'attacco.

Versione minima:

- `ItemAttack.conditionText` resta il fallback testuale

Versione evoluta:

- effetto strutturato con:
  - `effectType = DAMAGE`
  - `damageType = poison`
  - `diceExpression = 1d4`
  - `savingThrowAbility = CONSTITUTION`
  - `savingThrowDc = 10`
  - `successOutcome = NEGATES`

### Perche' non basta ItemFeature

`ItemFeature` e' perfetto per:

- poteri conceduti dall'oggetto
- abilita' a volonta' o a riposo
- passivi descrittivi

Ma non e' ideale per:

- consumare una pozione
- lanciare una bomba
- applicare veleno
- risolvere cure o danni strutturati

Per questi casi il trigger giusto non e' "feature dell'oggetto", ma "uso dell'oggetto".

### Scelta consigliata

Per non sovraccaricare subito il sistema:

- mantenere oggi le pozioni come `CONSUMABLE`
- introdurre `ItemUseEffect` come estensione v2 mirata
- lasciare `ItemFeature` per i poteri equip/passivi
- lasciare `ItemAttack` per i profili d'attacco

### Benefici

Con `ItemUseEffect` il sistema diventa pronto a gestire in modo coerente:

- pozioni di cura
- pozioni con buff
- veleni
- bombe e oggetti da lancio consumabili
- oggetti monouso con TS

## Ordine di lavoro consigliato

### Fase A: Consolidamento modello dati

- completare e validare lo schema Prisma
- fissare il contratto dati di ogni categoria item

### Fase B: Strategia di migrazione

- mappare `equipment.attacks` -> `ItemDefinition` / `CharacterItem` / `ItemAttack`
- mappare `equipment.items` -> `ItemDefinition` / `CharacterItem`
- decidere come migrare `equipment.equipment` legacy
- decidere come inizializzare o meno lo storico per i dati gia' esistenti

### Fase C: Seed / backfill

- creare definizioni base per armi, armature, scudi, anelli, ecc.
- normalizzare i dati esistenti
- legare i personaggi alle istanze corrette

### Fase D: Logica applicativa

- implementare `canEquip`
- implementare risoluzione attacchi disponibili
- implementare calcolo CA da equipaggiamento

### Fase E: UI

- sostituire gradualmente la UI attuale inventory
- mostrare slot occupati
- mostrare scelta slot dove serve
- mostrare attacchi derivati dall'equip

## Decisioni ancora aperte

- se per gli anelli vogliamo scelta esplicita sempre o auto-assegnazione al primo slot libero
- se per le armi a una mano vogliamo scelta esplicita della mano o assegnazione automatica
- come modellare in v1 il caso "arma + scudo" lato UX
- come gestire eventuali modificatori complessi non riconducibili a `ItemModifier`
- se introdurre presto una formula base della CA senza armatura fuori dal JSON legacy

## Prossimo passo

Prima di toccare la UI, serve sistemare i dati.

Il prossimo step consigliato e':

- definire il mapping preciso dai dati attuali alle nuove entita'
- decidere le regole di deduplicazione per `ItemDefinition`
- preparare la migrazione iniziale dell'inventario
