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
- Il prossimo level-up reale della campagna richiede il multiclasse: stabilizzazione e progressione hanno precedenza sulle altre nuove funzioni.

## Sequenza consigliata

| Fase proposta | Obiettivo | Priorita | Motivazione dell'ordine |
| --- | --- | --- | --- |
| P0, pre-1.8 | Stabilizzazione core scheda | Massima/bloccante | Elimina perdita o sovrascrittura di dati e rende affidabili persistenza, realtime e autorizzazioni prima della progressione. |
| 1.8A | Gate tecnico della progressione | Massima/bloccante | Introduce contratti, modello classi, storico, PF/Dadi Vita e pool di risorse compatibili con il multiclasse. |
| 1.8B | Level-up guidato monoclasse | Massima, milestone interna | Collauda preview/apply atomici e resolver sul caso piu semplice; non e un lungo obiettivo separato dal multiclasse. |
| 1.8C | Estensione multiclasse | Massima, obiettivo operativo | Deve essere disponibile per il prossimo level-up reale di un giocatore. |
| Dopo 1.8 | Creazione guidata della scheda | Media | Riusa strutture e componenti della progressione gia collaudati, diventando un'aggiunta piu semplice e meno rischiosa. |
| Dopo 1.8 | Gestione del party e idoneita alle interazioni | Media | Resta utile per riservatezza e personaggi inattivi, ma non e propedeutica al prossimo level-up. |
| Trasversale | Migliorie UI e design system incrementale | Opportunistica | Si interviene mentre si toccano le schermate, senza aprire ora un restyling completo. |
| Futuro | Fondazioni e gestione multi-campagna | Molto bassa | Non c'e una necessita corrente; una one-shot puo usare temporaneamente un'istanza locale con dati dedicati. |
| Futuro | Tavolo tattico condiviso | Molto bassa | Grande investimento non necessario per il prossimo uso reale dell'app. |

## P0, pre-1.8 — Stabilizzazione core della scheda personaggio

> Stato al 2026-08-12: pacchetto P0 implementato e verificato. La persistenza core usa mutazioni seriali per personaggio, revisioni ottimistiche e ACK dopo commit; riposi e patch condividono lo stesso coordinatore; le aperture non riscrivono piu PF, Dadi Vita o slot; stanze, riconnessione e revoca Socket sono state consolidate. Completati inoltre il realtime dell'inventario/equipaggiamento e la reidratazione dei TS morte, modificabili soltanto a 0 PF. I dettagli e i P1-P3 ancora aperti sono raccolti in [`character-sheet-audit.md`](./character-sheet-audit.md).

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
- requisiti tecnici che il Gate 1.8A e le milestone successive dovranno riusare invece di reimplementare.

### Criterio di completamento

Ogni sezione della scheda ha una valutazione motivata e un percorso dati noto. I fix P0 necessari alla progressione e i P1 selezionati sono implementati, coperti da test di regressione e verificati in scenari multi-client; nessuna apertura, patch pendente, riposo o riconnessione puo sovrascrivere silenziosamente uno stato valido.

### Esito incremento P0 del 2026-08-12

- completati P0.1-P0.6 dell'audit con coda FIFO per slug, revisione canonica, commit atomici, lifecycle room e riconvalida delle sessioni Socket;
- rimossi i salvataggi automatici distruttivi di PF, Dadi Vita e slot all'apertura;
- aggiunto aggiornamento realtime post-commit dell'inventario normalizzato, incluso lo stato equipaggiato, nelle schede e nei riepiloghi aperti;
- reidratati e sincronizzati i TS morte; i riepiloghi DM e iniziativa continuano a mostrarli solo a 0 PF e scheda/server ne impediscono la modifica sopra 0 PF;
- verifiche tecniche superate: controllo sintassi server, TypeScript, build di produzione e revisione quality/security; test manuali dell'utente positivi sui casi concordati;
- nessuna modifica a schema o dati Railway; il lavoro prosegue dai P1 selezionati e dal Gate tecnico 1.8A.

## Dopo la progressione — Party gestito dal DM

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

## Dopo la progressione — Creazione guidata della scheda

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

## 1.8B — Level-up guidato monoclasse

> Il programma tecnico dettagliato e raccolto in [`multiclass-roadmap.md`](./multiclass-roadmap.md). La sequenza vincolante e: Gate di compatibilita 1.8A -> milestone monoclasse 1.8B -> multiclasse 1.8C. Il primo level-up usa gia `targetClassKey`, storico per livello e strutture plurali, ma il server consente una sola classe durante il collaudo 1.8B.

### Dipendenza

Va costruito dopo il Gate tecnico della progressione. La creazione guidata non e piu un prerequisito: sara aggiunta dopo, riusando il modello di scelte, prerequisiti, anteprima e conferma gia collaudato dal level-up.

### Perimetro consigliato

- anteprima del passaggio di livello senza scritture;
- aumento PF con metodo dichiarato;
- nuove risorse, competenze e scelte previste dal catalogo automatizzato;
- scelta strutturata della sottoclasse quando ogni singola classe raggiunge la soglia prevista dal regolamento adottato, usando il livello di quella classe e non il livello totale;
- riepilogo differenziale "prima/dopo";
- conferma finale atomica;
- procedura manuale per privilegi di sottoclasse e altre opzioni non automatizzate;
- storico minimo del level-up, utile per capire e correggere cosa e cambiato.

### Da rimandare inizialmente

- automazione completa del multiclass;
- validazione universale di ogni talento, incantesimo o eccezione;
- rollback automatico arbitrario dopo che il personaggio ha gia giocato con il nuovo livello.

## 1.8C — Estensione multiclasse

### Dipendenza

E l'obiettivo operativo prioritario per il prossimo level-up reale. Parte dopo il collaudo della milestone monoclasse, ma appartiene allo stesso percorso di consegna e non introduce un secondo motore: estende la stessa preview/apply scegliendo se incrementare una classe posseduta o prendere il primo livello in una nuova classe.

### Perimetro consigliato

- prerequisiti della nuova classe secondo il ruleset;
- competenze specifiche dell'ingresso multiclass, distinte dalla classe iniziale;
- PF e Dado Vita attribuiti al livello della classe scelta;
- livello totale, livelli di classe e livello effettivo caster distinti;
- Spellcasting e Pact Magic separati;
- sottoclasse indipendente per ciascuna classe alla propria soglia;
- regole censite di cumulo e non cumulo dei privilegi;
- stesso storico, anteprima, conferma atomica e gestione conflitti della 1.8B.

### Criterio di completamento

L'aggiunta della seconda classe non richiede migrazioni dei level-up gia registrati, non ricalcola distruttivamente PF o risorse e non introduce un nuovo contratto di progressione.

## Trasversale — Migliorie UI opportunistiche

### Strategia consigliata

Non e previsto ora un restyling completo. Quando una schermata viene modificata per stabilizzazione o progressione, si possono estrarre componenti riusabili e correggere incoerenze evidenti se il costo e il rischio restano contenuti. Evitare una riscrittura unica che mescoli grafica e logica di dominio.

### Fasi interne

1. Inventario delle schermate e dei pattern incoerenti.
2. Direzione visiva: colori, tipografia, spaziature, icone, superfici e tono grafico.
3. Componenti fondamentali: layout, navigazione, modali, form, tabelle, card, stati vuoti e feedback.
4. Migrazione area player.
5. Migrazione area DM e schermate ad alta densita.
6. Revisione responsive, accessibilita e prestazioni.

### Relazione con le funzioni future

Il restyling non e piu un gate per la multi-campagna. Se quella funzione tornera prioritaria, si rivalutera allora quanta parte della navigazione globale conviene consolidare prima.

## Futuro a bassa priorita — Fondazioni tecniche multi-campagna

Questa versione non deve ancora permettere di creare una seconda campagna. Serve a rendere esplicita la campagna attuale e a migrare i dati in sicurezza.

Non esiste al momento una necessita operativa sufficiente a giustificare questo intervento trasversale. Per una one-shot occasionale e accettabile usare, se necessario, un'istanza locale separata dell'app con un set di dati dedicato.

### Lavoro previsto

- introdurre l'entita `Campaign` e creare la campagna predefinita dai dati esistenti;
- assegnare in modo additivo `campaignId` ai dati di dominio;
- rendere globali soltanto account e autenticazione;
- preparare appartenenza dell'utente alla campagna e ruolo nel suo contesto;
- rendere esplicito lo scope nelle query, negli endpoint e nelle stanze realtime;
- isolare file persistenti, documenti e risorse per campagna;
- aggiungere verifiche che impediscano relazioni tra campagne;
- mantenere l'UI bloccata sulla campagna predefinita fino all'eventuale attivazione della multi-campagna.

### Motivo della release separata

Il rischio maggiore non e creare la schermata "Nuova campagna", ma dimenticare una query senza filtro e mostrare o modificare dati dell'altra campagna. La migrazione dello scope deve essere verificata mentre il comportamento visibile resta invariato.

## Futuro a bassa priorita — Multi-campagna

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

## Futuro a bassa priorita — Tavolo tattico condiviso

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
Stabilizzazione P0 e test di regressione
        |
        +--> Gate progressione (1.8A)
                    |
                    +--> Level-up monoclasse (1.8B, milestone)
                                |
                                +--> Multiclasse (1.8C, obiettivo operativo)
                                            |
                                            +--> Creazione guidata

Party gestito -------------------------------> backlog successivo indipendente

Migliorie UI -------------------------------> opportunistiche lungo il percorso

Fondazioni multi-campagna --> Multi-campagna --> Tavolo tattico
        (intero ramo futuro a priorita molto bassa)
```

## Decisioni aperte da riprendere

### Da chiudere prima dell'automazione 1.8A

1. Confermare SRD 5.1/2014 come ruleset base e censire separatamente le house rule effettive della campagna.
2. Confermare l'autorita V1 del level-up: raccomandazione corrente, operazione eseguita soltanto dal DM.
3. Confermare prerequisiti multiclasse standard con eventuale override DM esplicito e motivato.
4. Stabilire per ogni livello la scelta fra media, tiro e inserimento manuale dei PF, registrando sempre il valore applicato.
5. Rendere esplicita la policy dei riposi e del recupero Dadi Vita prima di normalizzare quei dati.

### Rinviate con le funzioni non prioritarie

1. Visibilita e modifica player dei PG **In preparazione** e distinzione fra fuori party e ritirato.
2. Autorita e approvazione della futura creazione guidata.
3. Direzione di un eventuale restyling completo.
4. Ruoli per campagna e movimento delle pedine del tavolo tattico.

## Parcheggio idee

Nuove idee possono essere annotate qui senza assegnare subito una versione. Durante la successiva revisione della roadmap verranno valutate per valore, dipendenze, rischio e costo di manutenzione.

- Nessuna idea non classificata al momento.
