# Roadmap di prodotto

Appunto vivo per raccogliere, ordinare e affinare le prossime funzionalita di **Cronache della Trama e del Fato**.

La roadmap esprime priorita e dipendenze, non scadenze. Le versioni proposte possono essere spezzate se, durante l'analisi, una funzione risulta troppo ampia per un singolo rilascio.

## Principi guida

- Il DM controlla sempre partecipazione, visibilita e confini della campagna.
- Un personaggio preparato o archiviato non deve diventare implicitamente disponibile agli altri giocatori.
- Le regole automatizzate devono provenire soltanto da contenuti utilizzabili con certezza; tutto il resto deve restare inseribile e gestibile manualmente.
- Le nuove strutture dati devono preparare la multi-campagna senza rendere fragile l'app a campagna singola.
- Ogni funzione realtime deve mantenere autorizzazioni server-side: nascondere un comando nella UI non e sufficiente.
- La mappa tattica non deve trasformare subito l'app in un clone completo di Roll20.

## Sequenza consigliata

| Fase/versione proposta | Obiettivo | Complessita | Motivazione dell'ordine |
| --- | --- | --- | --- |
| Fase 0, pre-1.8 | Audit completo della scheda personaggio | Media come analisi, variabile per i fix | Stabilisce cosa funziona davvero, cosa manca e quali fondamenta servono prima di costruire wizard e level-up. |
| 1.8 | Gestione del party e idoneita alle interazioni | Medio-alta | Chiude subito un problema di riservatezza e definisce chi puo interagire con chi. |
| 1.9 | Creazione guidata della scheda | Alta | Introduce un ciclo di creazione controllato, riusabile anche dai futuri level-up. |
| 1.10 | Level-up guidato | Alta | Riusa motore, componenti e tracciamento delle scelte costruiti nella 1.9. |
| 1.11 | Fondazioni UI e restyling completo | Alta | Stabilizza navigazione e componenti prima di aggiungere la selezione campagna. |
| 1.12 | Preparazione tecnica multi-campagna | Molto alta | Introduce e migra il confine di campagna senza esporre ancora la seconda campagna. |
| 2.0 | Gestione di piu campagne | Molto alta/critica | Completa isolamento dati, utenti e realtime dopo una migrazione preparatoria separata. |
| 2.1+ | Tavolo tattico condiviso | Molto alta/epica | Funzione autonoma, piu sicura da costruire sopra campagne e UI gia consolidate. |

## Fase 0, pre-1.8 — Audit completo della scheda personaggio

### Obiettivo

Prima di aggiungere nuove funzioni, verificare sistematicamente cosa della scheda e gia gestito correttamente, cosa funziona soltanto in alcuni casi e cosa manca del tutto. L'audit deve produrre una base affidabile per decidere i fix immediati e per progettare creazione guidata e level-up senza consolidare errori esistenti.

Questa fase e principalmente di analisi e non coincide necessariamente con una release. I problemi trovati verranno classificati e assegnati alla versione appropriata: correzioni isolate in una patch 1.7.x, consolidamenti piu ampi in una minor dedicata o nel prerequisito della funzione che ne dipende.

### Aree da verificare

- identita, proprietario, assegnazione e permessi DM/player;
- persistenza dei campi e distinzione tra dati normalizzati e dati legacy in `Character.data`;
- caratteristiche, modificatori, bonus di competenza e tiri salvezza;
- abilita, competenze, expertise e bonus situazionali;
- classe, livello, sottoclasse, multiclass e Dadi Vita;
- punti ferita, PF temporanei, CA, iniziativa, velocita e sensi;
- attacchi, armi, competenza, danni e proprieta;
- inventario, equipaggiamento, carico, valuta e oggetti con risorse;
- capacita, risorse a consumo e reset su riposo breve/lungo;
- incantesimi, caratteristica da incantatore, CD, attacco e slot, inclusa Pact Magic;
- condizioni, TS contro morte, resistenze, immunita e altri stati di combattimento;
- lingue, competenze strumenti e tratti narrativi;
- calcoli derivati automatici, override manuali e loro precedenza;
- modifica della scheda da parte del DM e del player;
- comportamento dopo refresh, riavvio server e aggiornamenti realtime;
- resa desktop/mobile, accessibilita di base, errori e stati vuoti;
- storico o tracciabilita delle modifiche dove una variazione puo essere difficile da ricostruire.

### Metodo di analisi

1. Censire ogni sezione visibile della scheda e la relativa sorgente dati.
2. Tracciare il percorso completo UI → API → validazione server → SQLite → ricaricamento.
3. Confrontare calcoli duplicati tra frontend, backend e moduli condivisi.
4. Preparare casi di prova con personaggi semplici e casi limite: bonus negativi, multiclass, Warlock, expertise, oggetti equipaggiati e risorse esaurite.
5. Verificare autorizzazioni e ownership chiamando anche direttamente le API, non soltanto tramite UI.
6. Separare i risultati in bug, regole incomplete, UX mancante, debito tecnico e nuove funzionalita.

### Classificazione dei risultati

- **P0 — Integrita o sicurezza**: perdita/sovrascrittura dati, accessi non autorizzati o calcoli che alterano lo stato in modo errato.
- **P1 — Correttezza di gioco**: valori o regole centrali sbagliati nei casi normalmente usati.
- **P2 — Copertura incompleta**: caso valido non gestito o gestito soltanto manualmente senza che sia chiaro.
- **P3 — UX/debito tecnico**: comportamento corretto ma difficile da usare, duplicato o fragile.
- **Fuori perimetro**: automazioni che appartengono esplicitamente a creazione guidata, level-up o funzioni future.

### Output attesi

- matrice delle sezioni della scheda con stato **corretto**, **parziale**, **mancante** o **da verificare**;
- elenco dei problemi con priorita, impatto, riproduzione e soluzione consigliata;
- mappa delle dipendenze tra dati sorgente, calcoli derivati e override;
- suite minima di test di regressione da conservare;
- lista dei fix da completare prima della 1.8;
- requisiti tecnici che la 1.9 e la 1.10 dovranno riusare invece di reimplementare.

### Criterio di completamento

Ogni sezione della scheda ha una valutazione motivata e un percorso dati noto. I problemi P0/P1 hanno una destinazione precisa e sappiamo quali parti sono abbastanza affidabili da diventare fondamenta della creazione guidata e del level-up.

## 1.8 — Party gestito dal DM

### Problema

Oggi ogni personaggio assegnato a un player viene trattato implicitamente come membro del party. Un PG ancora in preparazione puo quindi comparire troppo presto in chat, scambi, destinatari o altre interazioni.

### Proposta funzionale

Introdurre uno stato esplicito del personaggio, gestito dal DM:

- **In preparazione**: visibile al DM e al suo eventuale proprietario solo dove serve alla compilazione; escluso da tutte le interazioni tra PG.
- **Nel party**: personaggio attivo e pienamente interagibile.
- **Fuori dal party**: personaggio conservato ma escluso dalle interazioni correnti; utile per assenze, separazioni o personaggi ritirati.

L'assegnazione di un PG a un utente e la sua appartenenza al party devono restare concetti distinti.

### Processi da rendere consapevoli del party

- elenco destinatari e autorizzazioni della chat;
- scambi di oggetti e valuta tra personaggi;
- roster, selettori e scorciatoie del DM;
- diario, documenti e comandi come "tutto il party";
- tracker iniziativa e funzioni collettive, quando usano il roster attivo;
- riposi di gruppo;
- negozi e visite, se un selettore deve proporre solo PG attivi;
- notifiche realtime e stanze Socket.IO;
- qualsiasi endpoint che accetta il personaggio destinatario: la regola va validata sul server.

### Analisi necessaria prima dello sviluppo

- Definire se il proprietario puo aprire e modificare la scheda di un PG **In preparazione**.
- Definire se **Fuori dal party** blocca ogni scambio o soltanto la sua creazione, lasciando consultabile lo storico.
- Censire tutti i punti in cui oggi "tutti i personaggi" equivale implicitamente a "party".
- Scegliere nomi e stati dati che possano sopravvivere alla futura aggiunta di `campaignId`.

### Criterio di completamento

Un PG non attivo non appare come possibile interlocutore o destinatario e non puo essere forzato in un'interazione chiamando direttamente le API. Il DM continua a poterlo amministrare.

## 1.9 — Creazione guidata della scheda

### Obiettivo

Fornire una procedura a step che riduca errori e lavoro ripetitivo, senza rendere l'app dipendente da contenuti non distribuibili.

### Perimetro consigliato

- identita del personaggio e informazioni narrative;
- caratteristiche e metodo di assegnazione dei punteggi;
- specie/razza, classe, background e competenze solo quando disponibili nel catalogo consentito;
- punti ferita, equipaggiamento iniziale e riepilogo finale;
- salvataggio in bozza e ripresa successiva;
- modalita **manuale/personalizzata** sempre disponibile per opzioni non automatizzate;
- provenienza esplicita dei dati di regola, separata dal motore di calcolo.

### Gate legale e contenutistico

Prima di importare testi o opzioni bisogna verificare puntualmente fonte, licenza, attribuzione e versione. Il wizard deve poter automatizzare solo il catalogo approvato; per il resto puo guidare la struttura della scelta senza incorporarne descrizioni o regole protette.

### Rischi principali

- il modello attuale della scheda potrebbe non distinguere bene scelta originaria, valore calcolato e modifica manuale;
- multiclass, talenti, sottoclassi e contenuti personalizzati moltiplicano le combinazioni;
- correggere una scelta precedente deve ricalcolare soltanto cio che ne dipende, senza sovrascrivere personalizzazioni del DM.

### Criterio di completamento

Si puo creare e riprendere una bozza, completare un PG usando il catalogo automatizzato oppure opzioni manuali, vedere un riepilogo delle scelte e produrre una scheda coerente senza modifiche nascoste.

## 1.10 — Level-up guidato

### Dipendenza

Va costruito dopo la creazione guidata, riusando lo stesso modello di scelte, prerequisiti, anteprima e conferma.

### Perimetro consigliato

- anteprima del passaggio di livello senza scritture;
- aumento PF con metodo dichiarato;
- nuove risorse, competenze e scelte previste dal catalogo automatizzato;
- riepilogo differenziale "prima/dopo";
- conferma finale atomica;
- procedura manuale per classi, sottoclassi e opzioni non automatizzate;
- storico minimo del level-up, utile per capire e correggere cosa e cambiato.

### Da rimandare inizialmente

- automazione completa del multiclass;
- validazione universale di ogni talento, incantesimo o eccezione;
- rollback automatico arbitrario dopo che il personaggio ha gia giocato con il nuovo livello.

## 1.11 — Restyling UI e grafica

### Strategia consigliata

Prima definire un piccolo design system, poi migrare le schermate per famiglie. Evitare una riscrittura unica che mescoli grafica e logica di dominio.

### Fasi interne

1. Inventario delle schermate e dei pattern incoerenti.
2. Direzione visiva: colori, tipografia, spaziature, icone, superfici e tono grafico.
3. Componenti fondamentali: layout, navigazione, modali, form, tabelle, card, stati vuoti e feedback.
4. Migrazione area player.
5. Migrazione area DM e schermate ad alta densita.
6. Revisione responsive, accessibilita e prestazioni.

### Perche prima della 2.0

La multi-campagna aggiungera selezione e contesto campagna alla navigazione globale. E preferibile inserirli in una struttura UI gia coerente, invece di duplicare adattamenti su schermate destinate a essere ridisegnate.

## 1.12 — Fondazioni tecniche multi-campagna

Questa versione non deve ancora permettere di creare una seconda campagna. Serve a rendere esplicita la campagna attuale e a migrare i dati in sicurezza.

### Lavoro previsto

- introdurre l'entita `Campaign` e creare la campagna predefinita dai dati esistenti;
- assegnare in modo additivo `campaignId` ai dati di dominio;
- rendere globali soltanto account e autenticazione;
- preparare appartenenza dell'utente alla campagna e ruolo nel suo contesto;
- rendere esplicito lo scope nelle query, negli endpoint e nelle stanze realtime;
- isolare file persistenti, documenti e risorse per campagna;
- aggiungere verifiche che impediscano relazioni tra campagne;
- mantenere l'UI bloccata sulla campagna predefinita fino alla 2.0.

### Motivo della release separata

Il rischio maggiore non e creare la schermata "Nuova campagna", ma dimenticare una query senza filtro e mostrare o modificare dati dell'altra campagna. La migrazione dello scope deve essere verificata mentre il comportamento visibile resta invariato.

## 2.0 — Multi-campagna

### Esperienza DM

- creare, rinominare, archiviare e selezionare campagne;
- invitare o abilitare utenti per una specifica campagna;
- assegnare ruoli e personaggi nel contesto corretto;
- passare da una campagna all'altra senza mescolare dashboard, realtime o dati.

### Regole fondamentali

- ogni personaggio appartiene a una sola campagna;
- non e previsto il trasferimento di personaggi tra campagne;
- un utente puo partecipare a piu campagne, ma vede solo quelle abilitate;
- party, chat, inventari, negozi, diario, documenti, tracker, bestiario personalizzato e stato sessione sono isolati per campagna;
- ogni ID ricevuto dal client deve essere verificato anche rispetto alla campagna attiva;
- il cambio campagna deve cambiare anche stanze Socket.IO, cache e stato client.

### Complessita

E una modifica trasversale a quasi ogni tabella, endpoint e flusso realtime. Richiede migrazioni additive, audit sistematico delle autorizzazioni, test di isolamento con almeno due campagne e piano di rollback basato su backup Railway.

### Criterio di completamento

Due campagne possono essere usate dagli stessi account senza che dati, selettori, notifiche o azioni di una risultino accessibili nell'altra. I personaggi restano definitivamente legati alla campagna di origine.

## 2.1+ — Tavolo tattico condiviso

### Visione

Una modalita di gioco remota con mappa e pedine sincronizzate, integrata con personaggi e combattimenti esistenti ma non equivalente a un VTT completo.

### MVP realistico

- una scena attiva per campagna;
- immagine di sfondo caricata dal DM;
- griglia quadrata opzionale e zoom/pan;
- pedine di PG e creature, con movimento realtime autorizzato;
- visibilita base delle pedine;
- collegamento al tracker iniziativa;
- persistenza di scena, posizioni e ordine dei livelli;
- modalita sola consultazione per i player quando il DM blocca i movimenti.

### Espansioni da valutare dopo l'MVP

- fog of war e aree rivelate;
- righello e misurazione;
- forme/annotazioni;
- piu scene preparate;
- line of sight dinamica;
- dadi e chat contestuali.

### Limiti iniziali consigliati

Niente videochiamata, marketplace di asset, macro generiche, illuminazione dinamica avanzata o editor mappe completo. Queste funzioni cambierebbero ordine di grandezza al progetto.

## Dipendenze principali

```text
Audit scheda (Fase 0)
        |
        +--> Fix prioritari e test di regressione
        |
        +--> Party gestito (1.8)
        |           |
        |           +--> Fondazioni multi-campagna (1.12) --> Multi-campagna (2.0)
        |
        +--> Creazione guidata (1.9) --> Level-up (1.10)

Restyling UI (1.11) -----------------------------> Multi-campagna (2.0)

Multi-campagna (2.0) + tracker/realtime esistenti --> Tavolo tattico (2.1+)
```

## Decisioni aperte da riprendere

1. L'audit deve verificare soltanto il comportamento dell'app o anche la copertura delle regole SRD che la scheda dichiara di supportare? E consigliato includere entrambe, tenendole separate nei risultati.
2. Un player puo vedere e modificare la propria scheda mentre il PG e **In preparazione**?
3. Serve distinguere **Temporaneamente fuori dal party** da **Ritirato/archiviato**, o basta un solo stato inattivo?
4. La creazione guidata e avviata dal DM, dal player autorizzato o da entrambi?
5. Il DM deve approvare la creazione e ogni level-up prima che diventino effettivi?
6. Il restyling deve conservare l'identita visiva attuale evolvendola o partire da una direzione completamente nuova?
7. Nella 2.0 il ruolo DM e globale oppure un utente puo essere DM in una campagna e player in un'altra? La seconda opzione e piu flessibile ed e quella consigliata.
8. Per la mappa, i player possono muovere soltanto le proprie pedine o anche quelle alleate autorizzate?

## Parcheggio idee

Nuove idee possono essere annotate qui senza assegnare subito una versione. Durante la successiva revisione della roadmap verranno valutate per valore, dipendenze, rischio e costo di manutenzione.

- Nessuna idea non classificata al momento.
