# Roadmap Rework Monete

## Obiettivo

Portare le monete fuori dal JSON legacy del personaggio e introdurre un modello:

- con saldo corrente rapido da leggere e usare in scheda
- con storico transazioni completo
- coerente con i flussi PG, DM e riferimenti esterni testuali

Il nuovo sottosistema deve coprire:

- entrate e uscite monete
- passaggi tra PG
- passaggi tra PG e riferimenti esterni testuali
- loot e ritrovamenti senza mittente strutturato
- causale e descrizione eventuale dell'acquisto
- annullamento delle transazioni da parte del DM

## Decisioni approvate

### Modello generale

Scelta approvata:

- `saldo corrente + storico`

Quindi:

- una fonte di verita' semplice per il saldo attuale del personaggio
- uno storico separato per audit, correzioni e contesto narrativo

### Denominazioni supportate

Scelta approvata:

- `cp`
- `sp`
- `ep`
- `gp`

Decisione esplicita:

- `pp` viene rimossa dal modello futuro

Implicazione:

- eventuali monete di platino legacy vanno convertite in oro in fase di migrazione
- conversione approvata: `1 pp = 10 gp`

### Conversione valuta

#### Entrate

Per le entrate:

- nessuna conversione automatica
- si registra il taglio effettivamente ricevuto

Esempio:

- se ricevo `100 sp`, restano `100 sp`

#### Uscite

Per le uscite:

- il sistema deve poter convertire automaticamente da tagli superiori per coprire il pagamento

Esempio:

- devo spendere `5 sp`
- non ho `sp`
- ho `gp`
- il sistema fa il cambio e copre il resto

#### Utility di conversione

Scelta approvata:

- esiste una utility separata per convertire volontariamente il saldo
- non e' parte implicita dell'entrata

Da confermare in implementazione:

- se la conversione utility debba scrivere una transazione storica dedicata

Raccomandazione:

- si', con causale `Cambio valuta`

### Multi-target

Scelta approvata:

- non supportato in v1

Quindi:

- una transazione riguarda un solo mittente e un solo destinatario logico
- distribuzioni multiple si modellano con piu' transazioni

### Riferimenti esterni

Scelta approvata:

- i PNG o riferimenti esterni sono solo testo in v1

Quindi:

- niente entita' NPC strutturate
- ma campi separati per nome esterno in ingresso/uscita

### Acquisti e negozio

Scelta approvata:

- nessun legame rigido in v1 tra transazione monete e transazione oggetti
- si usa solo un campo descrittivo opzionale per l'acquisto

## Stato attuale

Le monete sono ancora principalmente legacy.

Fonte attuale:

- `characterData.equipment.coins` nella scheda personaggio

La logica di:

- somma
- spesa
- resto
- compattazione

vive ancora nel frontend della scheda.

### Già presente nel DB

Esistono gia':

- enum `CurrencyType`
- modello `InventoryTransactionCurrency`

### Verifica di utilizzo reale

Stato verificato:

- `InventoryTransactionCurrency` e' presente nello schema Prisma
- non risulta usata nei flussi runtime applicativi
- non esistono ancora API monete che la consumino
- compare solo come struttura prevista e in uno script di backfill che la pulisce

Conclusione:

- possiamo scegliere di non usarla
- possiamo anche rimuoverla piu' avanti senza rompere un flusso attivo

## Scelta modellazione v1

Scelta approvata:

- non usare una tabella separata per le righe valuta
- mettere le colonne valuta direttamente sulla transazione

Motivazione:

- e' piu' leggibile
- e' piu' semplice da interrogare
- le denominazioni sono poche e fisse
- evita una join inutile

## Modello dati proposto

### 1. CharacterCurrencyBalance

Nuova tabella proposta per il saldo corrente.

Campi:

- `characterId`
- `cp`
- `sp`
- `ep`
- `gp`
- `updatedAt`

Scopo:

- leggere velocemente il saldo corrente in scheda
- avere una fonte di verita' semplice per i controlli di spesa

### 2. CurrencyTransaction

Nuova tabella proposta per lo storico monete.

Campi proposti:

- `id`
- `fromCharacterId?`
- `toCharacterId?`
- `fromExternalName?`
- `toExternalName?`
- `reason?`
- `purchaseDescription?`
- `note?`
- `cp`
- `sp`
- `ep`
- `gp`
- `createdByUserId?`
- `createdAt`
- `reversedAt?`
- `reversalOfTransactionId?`

Regola di validazione approvata:

- almeno uno tra `fromCharacterId` e `toCharacterId` deve essere valorizzato

Questa regola copre:

- PG -> PG
- PG -> riferimento esterno
- riferimento esterno -> PG
- loot / ritrovamento verso PG senza mittente strutturato

## Casi d'uso v1 approvati

### 1. PG -> PG

Esempio:

- Aros da' 5 mo a Narak

### 2. PG -> riferimento esterno

Esempio:

- Narak paga 10 mo all'oste Pinco Pallino

### 3. Riferimento esterno -> PG

Esempio:

- un mercante restituisce 3 ma a un personaggio

### 4. Loot o ritrovamento

Esempio:

- `trovate nel cadavere del goblin`

### 5. Entrata generica

Esempio:

- ricompensa missione

### 6. Uscita generica

Esempio:

- pedaggio
- offerta
- spesa manuale non legata a un negozio

## Regole applicative v1

### 1. Entrate

- aumentano il saldo del destinatario
- mantengono i tagli esatti ricevuti
- non fanno conversioni automatiche

### 2. Uscite

- scalano il taglio richiesto se disponibile
- se non basta, convertono da tagli superiori
- non permettono saldo complessivo negativo

### 3. Trasferimento tra PG

- diminuisce il saldo del mittente
- aumenta il saldo del destinatario
- registra una transazione unica

### 4. Annullo transazione

- riservato al DM
- deve ripristinare i saldi
- deve lasciare traccia storica del fatto che la transazione e' stata annullata

## UI prevista

### Player

In scheda personaggio:

- saldo corrente letto da DB
- azioni rapide:
  - aggiungi monete
  - spendi monete
  - trasferisci a un PG
  - converti monete

Campi opzionali nelle operazioni:

- da chi
- a chi
- motivo
- cosa sta comprando
- note

### DM

Sezione dedicata:

- storico transazioni monete
- filtri base
- annullamento transazioni

## Migrazione legacy

### Fonte legacy attuale

- `equipment.coins`

### Passi approvati

1. leggere le monete dal JSON legacy
2. convertire eventuali `pp` in `gp`
3. popolare il saldo corrente iniziale
4. passare la scheda a leggere dal DB
5. smettere di usare il JSON come fonte primaria

## Ordine di implementazione consigliato

### Fase 1

- eliminare `pp` dal dominio nuovo
- definire la migrazione `pp -> gp`

Stato:

- completato lato dominio applicativo legacy/UI
- la scala monete della scheda ora si ferma a `gp`
- eventuali `pp` lette dal JSON legacy vengono convertite automaticamente in `gp` con rapporto `1 pp = 10 gp`
- l'enum Prisma legacy non e' ancora stato rimosso, perche' il modello DB monete definitivo non e' ancora stato attivato

### Fase 2

- introdurre `CharacterCurrencyBalance`

Stato:

- completato
- esiste una tabella dedicata al saldo corrente per personaggio
- il server garantisce che ogni personaggio abbia una riga saldo almeno a zero
- il saldo non e' ancora la fonte letta dalla scheda: quello resta il passo successivo

### Fase 3

- introdurre `CurrencyTransaction`

Stato:

- completato
- esiste una tabella dedicata allo storico monete
- le colonne valuta stanno direttamente sulla transazione (`cp`, `sp`, `ep`, `gp`)
- il modello supporta gia' riferimenti:
  - PG mittente
  - PG destinatario
  - nomi esterni testuali
  - causale
  - descrizione acquisto
  - note
  - reversal metadata
- lo storico non e' ancora usato dai flussi applicativi: quello inizia con la migrazione e con le API delle fasi successive

### Fase 4

- migrare i saldi legacy da `equipment.coins`

Stato:

- completato
- i saldi legacy vengono letti da `equipment.coins`
- eventuali `pp` legacy vengono convertite in `gp` secondo la scala approvata
- il saldo corrente viene popolato in `CharacterCurrencyBalance`
- per ogni personaggio con portafoglio legacy valorizzato viene creata una transazione iniziale

Dettagli della transazione iniziale:

- mittente esterno: `DM`
- causale: `Assegnazione iniziale`
- nota: `Inizializzazione portafoglio`
- id stabile per evitare duplicazioni al riavvio

### Fase 5

- far leggere la scheda dal DB

Stato:

- completato
- la scheda personaggio legge ora il saldo monete da `CharacterCurrencyBalance`
- il JSON legacy non e' piu' la fonte primaria per la visualizzazione del portafoglio
- resta un fallback di sicurezza ai dati legacy solo se il saldo DB non e' disponibile
- le operazioni attive sulle monete in scheda vengono attivate con la fase successiva, per evitare scritture incoerenti mentre il flusso e' ancora in transizione

### Fase 6

- implementare entrate / uscite / trasferimenti

Stato:

- completato
- la scheda personaggio può ora registrare:
  - entrate monete
  - uscite monete
  - trasferimenti verso altri PG
- ogni operazione aggiorna il saldo corrente in `CharacterCurrencyBalance`
- ogni operazione registra una voce in `CurrencyTransaction`
- le uscite e i trasferimenti usano il cambio automatico da tagli superiori se necessario
- i target di trasferimento vengono letti da una lista dedicata di tutti i PG attivi, indipendente dai normali permessi di lettura scheda

### Fase 7

- aggiungere utility conversione

Stato:

- completato
- la scheda personaggio espone ora una quarta operazione `Converti`
- la conversione e' una utility separata da entrate, uscite e trasferimenti
- converte il taglio selezionato verso il taglio superiore fino al massimo possibile
- aggiorna il saldo corrente in `CharacterCurrencyBalance`
- registra due movimenti in `CurrencyTransaction` con causale `Cambio valuta`:
  - uscita del taglio originario
  - entrata del risultato convertito

### Fase 8

- aggiungere storico DM con annullamento

Stato:

- completato
- il DM ha una sezione dedicata allo storico monete
- le operazioni vengono lette a livello di `operationId`, quindi anche il cambio valuta appare come operazione unica
- il DM può annullare le operazioni registrate
- l'annullamento ripristina i saldi quando i portafogli correnti lo consentono
- gli annulli aggiornano anche le schede aperte via realtime

## Cose esplicitamente fuori scope v1

- multi-destinatario
- NPC come entita' vere
- negozio integrato
- legame forte tra transazioni oggetti e transazioni monete
