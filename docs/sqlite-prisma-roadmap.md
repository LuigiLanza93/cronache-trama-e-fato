# Roadmap Migrazione a SQLite + Prisma

## Obiettivo

Evolvere la base dati dall'attuale insieme di file JSON a una base dati strutturata, unica e locale, basata su SQLite + Prisma.

Vincoli desiderati:

- niente soluzioni miste a regime
- tutto eseguibile facilmente in locale
- mantenere le feature attuali dell'app
- ridurre il rischio della migrazione facendo il passaggio per step

## Direzione Tecnica

- Database: SQLite
- ORM / access layer: Prisma
- Runtime target: locale, senza servizio DB separato
- Approccio migrazione: prima importiamo i dati attuali, poi sostituiamo gradualmente il layer JSON nel backend

## Fase 1: Definizione Modello Dati

Stato: completata

Definire quali entita' diventano tabelle e quali campi restano serializzati come JSON nel database.

Entita' iniziali candidate:

- `User`
- `Character`
- `Monster`
- `ChatMessage`
- `EncounterScenario`
- `EncounterScenarioEntry`

Decisioni da prendere in questa fase:

- ownership personaggi come relazione diretta su `Character`
- ruolo `dm/player` su `User`
- struttura scheda personaggio: metadati + payload JSON oppure schema piu' normalizzato
- struttura mostro: metadati + payload JSON
- chat come messaggi separati, non come blob unico

## Fase 2: Setup Prisma

Stato: completata con workaround operativo

Preparare l'infrastruttura minima per usare SQLite tramite Prisma.

Attivita':

- installare `prisma` e `@prisma/client`
- inizializzare Prisma nel progetto
- creare `prisma/schema.prisma`
- configurare SQLite
- creare la prima migration
- creare il file DB locale, ad esempio `prisma/dev.db`

Nota:

- su questa macchina il `schema engine` di Prisma fallisce su `migrate dev` / `db push`
- il setup e' stato comunque completato con un workaround stabile:
  - schema Prisma valido
  - SQL bootstrap generato da Prisma
  - DB SQLite inizializzato via `sqlite3`

## Fase 3: Disegno Schema Iniziale

Stato: completata

Creare uno schema che copra le feature attuali senza normalizzare subito tutto.

Schema MVP consigliato:

- `User`
- `Character`
- `Monster`
- `ChatMessage`
- `EncounterScenario`
- `EncounterScenarioEntry`

Scelta consigliata per limitare la complessita':

- `User` normalizzato
- `Character` con campi principali + `data` JSON
- `Monster` con campi principali + `data` JSON
- `ChatMessage` normalizzato
- `EncounterScenario` e `EncounterScenarioEntry` normalizzati

## Fase 4: Script di Migrazione Dai JSON

Stato: completata

Creare uno script che importi nel database i dati attuali.

Sorgenti da migrare:

- `src/data/users.json`
- `src/data/character-ownership.json`
- `src/data/characters/*.json`
- `src/data/monsters/**/*.json`
- `src/data/chats.json`
- `src/data/encounter-scenarios.json`

Output ottenuto:

- database SQLite popolato
- script di import disponibile
- preservazione dei riferimenti tra utenti, schede, mostri, chat e scenari presenti nei JSON sorgente

## Fase 5: Sostituzione Graduale Del Layer JSON

Stato: completata

Sostituire progressivamente in `server.js` il layer basato su file con query Prisma.

Ordine consigliato:

1. auth e utenti
2. personaggi e ownership
3. mostri
4. chat
5. scenari

Obiettivo:

- non rompere il frontend
- mantenere le API attuali il piu' possibile stabili

## Fase 6: Compatibilita' Applicativa

Stato: completata

Adattare il backend in modo che il frontend continui a funzionare con modifiche minime.

Focus:

- mantenere le route esistenti dove possibile
- cambiare l'implementazione interna, non il contratto API, se non strettamente necessario
- ridurre i regressions durante la migrazione

## Fase 7: Verifica Funzionale Completa

Stato: completata

Verificare che tutte le aree principali continuino a funzionare.

Checklist minima:

- login / logout / cambio password
- gestione utenti
- gestione schede
- creazione scheda
- associazione utente-personaggio
- chat DM <-> personaggio
- bestiario
- tracker iniziativa
- scenari di combattimento

Esito:

- verifica funzionale completata sul runtime SQLite
- regressioni emerse durante i test corrette nel branch di migrazione
- confermati i flussi principali lato DM e lato player
- confermata la persistenza della sessione dopo riavvio server

## Fase 8: Spegnimento Del Layer JSON

Stato: completata

Quando il database e' a regime:

- il runtime non deve piu' leggere/scrivere i JSON attuali
- i JSON restano solo come backup o sorgente storica
- eventuali export/import si faranno con script dedicati

Esito:

- il runtime applicativo usa SQLite per i dati principali
- i file storici sono stati spostati in `src/data/JSON_LEGACY`
- gli script di import continuano a usare `JSON_LEGACY` come sorgente
- il layer JSON non e' piu' parte del flusso operativo standard

## Principi Guida

- migrare senza rifare tutta l'app in una volta
- privilegiare stabilita' e reversibilita'
- mantenere tutto semplice da eseguire in locale
- evitare una normalizzazione eccessiva nella prima release DB

## Prossimo Passo

La migrazione core e' conclusa. I prossimi passi consigliati sono:

- manutenzione e hardening del codice migrato
- cleanup dei residui legacy non piu' necessari
- valutazione del merge del branch `migration` in `main`
- evoluzione funzionale dell'app su base SQLite
