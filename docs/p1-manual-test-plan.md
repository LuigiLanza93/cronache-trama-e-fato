# Piano di test manuale P1

Stato: pronto per il collaudo locale su `dev`. Non eseguire questi test su Railway.

## Preparazione

1. Avvia l'app locale con `npm.cmd run dev`.
2. Usa una scheda di prova, preferibilmente `schedaprova`, evitando i PG reali della campagna.
3. Apri due browser o una finestra normale e una anonima:
   - browser A: account DM;
   - browser B: proprietario della scheda di prova.
4. Apri la sessione player dalla dashboard DM.
5. Annota prima dei test: classe, livello, sei caratteristiche, PF, PF temporanei, Dadi Vita, TS morte, competenze, armi equipaggiate e risorse consumate.
6. Al termine di ogni caso fai refresh in entrambi i browser: il valore dopo refresh e quello autorevole.

Per ogni caso registra `PASS`, `FAIL` oppure `NON ESEGUITO`, aggiungendo screenshot e valore ottenuto in caso di errore.

## 1. Persistenza e feedback

### P1-SAVE-01 — Salvataggio normale

1. Apri la scheda nei due browser.
2. Dal browser B modifica un campo semplice, per esempio il background.
3. Osserva l'indicatore della scheda.

Atteso:

- compare `Salvataggio...`;
- dopo l'ACK compare `Salvato`;
- il browser A riceve il valore senza refresh;
- dopo refresh entrambi mostrano lo stesso valore.

### P1-SAVE-02 — Due modifiche rapide

1. Modifica rapidamente due rami diversi, per esempio PF temporanei e una caratteristica.
2. Attendi `Salvato`.
3. Fai refresh.

Atteso: entrambe le modifiche restano presenti; nessuna regredisce.

### P1-SAVE-03 — Concorrenza fra due client

1. Nei due browser modifica quasi contemporaneamente due campi differenti.
2. Se compare un conflitto, attendi la riconciliazione.

Atteso: nessun dato corrotto; l'eventuale conflitto mostra un errore chiaro e ricarica lo stato canonico. Una nuova modifica successiva deve salvarsi normalmente.

### P1-SAVE-04 — ACK mancante/rete interrotta

1. Attiva `Offline` negli strumenti sviluppatore del browser B oppure arresta il server locale.
2. Prova una modifica.
3. Attendi almeno 7 secondi.
4. Ripristina rete/server e ricarica.

Atteso:

- compare `Errore di salvataggio` e un messaggio esplicito;
- la UI non presenta il valore non confermato come definitivamente salvato;
- dopo il ripristino viene mostrato lo stato realmente persistito;
- una modifica successiva torna a `Salvato`.

## 2. Caratteristiche e punteggio zero

### P1-ABILITY-01 — Zero valido

1. Imposta Saggezza a `0` e conferma.
2. Chiudi e riapri la scheda.

Atteso: il valore resta `0`, il modificatore e `-5`; non torna a `10`.

### P1-ABILITY-02 — Limiti

Prova `-1`, `31`, un decimale e testo non numerico.

Atteso: il form non consente il salvataggio e mostra che sono ammessi solo interi `0..30`. Le altre cinque caratteristiche non cambiano.

## 3. Skill e Percezione passiva

Usa un PG di livello 5, quindi bonus competenza `+3`.

### P1-SKILL-01 — Non competente

1. Imposta Saggezza 10.
2. Disattiva Percezione.

Atteso: Percezione `+0`, Percezione passiva `10`.

### P1-SKILL-02 — Competente

1. Attiva Percezione.

Atteso: Percezione `+3`, Percezione passiva `13`.

### P1-SKILL-03 — Coerenza fra viste

Confronta il valore in:

- scheda PG;
- home player;
- dashboard DM;
- tracker iniziativa DM.

Atteso: tutte le viste mostrano lo stesso valore. Con Saggezza `0` e competenza al livello 5 il valore atteso e `8` (`10 - 5 + 3`).

## 4. Competenza nelle armi

Apri il dettaglio della formula dell'attacco; deve dichiarare se il bonus competenza e applicato.

### P1-WEAPON-01 — Gruppo competente

1. Usa un Guerriero livello 5.
2. Equipaggia un'arma semplice e una da guerra, una alla volta.

Atteso: entrambe aggiungono `+3` di bonus competenza.

### P1-WEAPON-02 — Gruppo non competente

1. Usa un Mago livello 5.
2. Equipaggia un'arma da guerra non inclusa nelle competenze specifiche, per esempio un'Alabarda.

Atteso: il tiro non aggiunge `+3`; il breakdown segnala arma non compresa nelle competenze.

### P1-WEAPON-03 — Competenze specifiche

Verifica almeno:

- Druido con Randello e Falcetto;
- Monaco con arma semplice e Spada corta;
- Ladro con Stocco;
- Mago con Pugnale.

Atteso: il bonus competenza viene aggiunto in tutti i casi.

### P1-WEAPON-04 — Arma custom non classificata

1. Crea o usa un'arma senza gruppo competenza.
2. Equipaggiala.

Atteso: nessun bonus competenza implicito; il breakdown indica classificazione mancante.

### P1-WEAPON-05 — Persistenza metadati catalogo

1. Da gestione oggetti crea un'arma di prova.
2. Imposta gruppo `Semplice` e flag `Arma leggera`.
3. Salva, ricarica la pagina e riapri l'oggetto.

Atteso: entrambi i valori restano salvati. Cambiando categoria a non-arma vengono rimossi.

### P1-WEAPON-06 — Competenza concessa da capacità passiva

1. Usa un Bardo senza competenza nelle armi da guerra ed equipaggia un'arma marziale.
2. Verifica che il bonus competenza non sia applicato.
3. Modifica la capacità passiva `Collegio Bardico del Valore` e aggiungi tre effetti di categoria `Competenza`:
   - `Armi da guerra`;
   - `Armature medie`;
   - `Scudi`.
4. Salva e riapri la capacità.

Atteso:

- ogni effetto Competenza mostra soltanto il bersaglio, senza valore, operazione o trigger;
- i tre effetti persistono e sono riepilogati con la relativa categoria;
- l'arma marziale ora aggiunge il bonus competenza;
- il breakdown cita `Collegio Bardico del Valore` come fonte;
- il semplice nome o testo della capacità, senza effetti strutturati, non concede nulla.

### P1-WEAPON-07 — Arma del Patto

1. Usa un Warlock non competente in una specifica arma marziale.
2. Equipaggia due istanze della stessa definizione, quando possibile, e lega soltanto la prima come Arma del Patto.
3. Confronta il tiro per colpire delle due istanze.
4. Evoca anche un modello di Arma del Patto e controllane l'attacco.

Atteso:

- la sola istanza legata aggiunge il bonus competenza e indica `Arma del Patto` nel breakdown;
- l'altra istanza della stessa arma resta non competente;
- l'arma virtuale evocata è competente;
- essere Warlock, senza legame o evocazione, non rende competenti in tutte le armi marziali.

### P1-WEAPON-08 — Riepilogo competenze e provenienza

1. Apri `Competenze & Abilità` con un Guerriero.
2. Verifica le sezioni `Armi` e `Armature & scudi`.
3. Apri un Bardo base e controlla anche le armi specifiche di classe.
4. Sul Bardo aggiungi gli effetti `PROFICIENCY` del Collegio del Valore descritti in P1-WEAPON-06, quindi rimuovili.
5. Controlla infine un Warlock con un'Arma del Patto attiva.

Atteso:

- il Guerriero mostra armi semplici e da guerra, tutte le armature e gli scudi, con fonte `Classe: Guerriero`;
- il Bardo base mostra armi semplici, armature leggere e le proprie armi specifiche, con fonte `Classe: Bardo`;
- gli effetti del Collegio aggiungono armi da guerra, armature medie e scudi usando la categoria della skill come fonte, per esempio `Sottoclasse: Collegio Bardico del Valore`, e scompaiono quando gli effetti vengono rimossi;
- un semplice nome/testo della capacità o un effetto malformato non compare nel riepilogo;
- l'Arma del Patto non viene promossa a competenza generale: resta una concessione valida soltanto per l'istanza legata o evocata.
- il riepilogo è collassabile, inizialmente chiuso e posizionato in fondo alla sezione;
- ogni fonte compare una sola volta, su una riga dedicata, e raccoglie sotto di sé tutte le competenze concesse, separate fra `Armi` e `Armature e scudi`;
- le etichette delle competenze iniziano con la maiuscola e restano leggibili anche su schermo mobile.

### P1-WEAPON-09 — Filtro armi da censire

1. Apri `Gestione oggetti` con almeno un'arma priva di gruppo competenza e una già classificata.
2. Seleziona `Armi da censire` nel filtro `Controllo competenze`.
3. Apri una voce risultante, assegna `Semplice` o `Da guerra` e salva.
4. Disattiva il filtro e prova anche la ricerca testuale e il filtro categoria.

Atteso:

- il conteggio include soltanto oggetti `WEAPON` senza `weaponProficiencyGroup`;
- il filtro mostra esclusivamente quelle armi e la lista le evidenzia come mancanti;
- dopo il salvataggio l'arma censita scompare subito dal filtro e il conteggio diminuisce;
- ricerca e filtro categoria continuano a combinarsi correttamente con il controllo competenze.

## 5. Combattere con Due Armi

Usa due armi da mischia distinte con proprietà `Leggera`, una per mano.

### P1-TWF-01 — Senza stile

1. Usa DES o FOR con modificatore positivo.
2. Assicurati che il PG non abbia una feature/capacità chiamata `Combattere con Due Armi`.

Atteso:

- l'attacco della mano sinistra è indicato come `Azione bonus: Combattere con Due Armi`;
- il bonus caratteristica si applica al tiro per colpire;
- il bonus caratteristica positivo non si applica ai danni.

### P1-TWF-02 — Con stile

1. Aggiungi la capacità `Combattere con Due Armi`.

Atteso: il modificatore positivo viene aggiunto anche ai danni dell'attacco bonus.

### P1-TWF-03 — Modificatore negativo

Usa una caratteristica d'attacco con modificatore negativo e rimuovi lo stile.

Atteso: il modificatore negativo resta applicato ai danni.

### P1-TWF-04 — Arma non leggera o non da mischia

Sostituisci una delle due armi con un'arma non leggera oppure senza attacco da mischia.

Atteso: la riga sinistra non viene presentata come attacco bonus TWF e non subisce la regola di rimozione del modificatore.

## 6. Riposo breve SRD 5.1

Prepara un PG livello 5, Dado Vita d8, COS 14 (`+2`), PF `10/30`, 3 Dadi Vita disponibili.

### P1-REST-S01 — Zero dadi

1. Apri il riposo breve.
2. Seleziona `0` dadi e totale naturale `0`.
3. Controlla anteprima e applica.

Atteso: PF e Dadi Vita non cambiano; le risorse `shortRest` vengono recuperate; il riposo non è bloccato da un contatore massimo.

### P1-REST-S02 — Due dadi

1. Seleziona 2 dadi e inserisci totale naturale `9`.

Atteso: cura prevista `13` (`9 + 2*2`), PF finali `23/30`, Dadi Vita `3 -> 1`. Anteprima e risultato applicato coincidono.

### P1-REST-S03 — Cap ai PF massimi

Con PF `28/30`, spendi 1 dado con totale naturale `8`.

Atteso: cura applicata `2`, PF finali `30`; il dado viene comunque consumato.

### P1-REST-S04 — Input invalidi

Prova più dadi di quelli disponibili, totale sotto il minimo naturale o sopra `numero dadi * taglia dado`.

Atteso: conferma disabilitata o errore server; nessun valore cambia.

### P1-REST-S05 — COS negativa

Con COS 6 (`-2`), spendi 1d8 con risultato naturale 1.

Atteso: la cura non scende sotto `0`; il Dado Vita viene consumato.

## 7. Riposo lungo SRD 5.1

### P1-REST-L01 — Recupero della metà

PG livello 5 con 1/5 Dadi Vita, PF mancanti e PF temporanei.

Atteso dopo il lungo:

- PF al massimo;
- PF temporanei a 0;
- recupero di 2 Dadi Vita, quindi `1 -> 3`;
- slot e risorse short/long recuperati;
- TS morte azzerati.

### P1-REST-L02 — Minimo un dado

PG livello 1 con 0/1 Dadi Vita.

Atteso: recupera 1 Dado Vita.

### P1-REST-L03 — Blocco a 0 PF

Imposta il PG a 0 PF e prova il lungo.

Atteso: il PG risulta bloccato, con motivazione; nessun dato cambia.

### P1-REST-L04 — Un solo lungo nelle 24 ore

Applica un lungo valido e riprova subito.

Atteso: il secondo è bloccato; nessun reset o recupero aggiuntivo.

### P1-REST-L05 — Applicazione parziale al roster

Seleziona insieme un PG idoneo e uno bloccato.

Atteso: il primo viene aggiornato, il secondo resta invariato; il riepilogo indica chiaramente l'applicazione parziale.

## 8. Regressioni P0 da ricontrollare

### P1-REG-01 — TS morte

- A 0 PF i pallini sono modificabili e persistono dopo refresh.
- Sopra 0 PF non sono modificabili.
- Un riposo breve che lascia il PG a 0 non li azzera.
- Una guarigione sopra 0 o un lungo valido li azzera.

### P1-REG-02 — Apertura senza scritture

Annota PF, Dadi Vita e slot; apri/chiudi/ricarica la scheda senza azioni.

Atteso: nessuno dei valori cambia.

### P1-REG-03 — Inventario realtime

Equipaggia o rimuovi un oggetto dal browser A.

Atteso: browser B aggiorna inventario, attacchi e statistiche derivate senza refresh manuale.

### P1-REG-04 — Sessione e ownership

- Chiudi la sessione: il player non può modificare la scheda.
- Esegui logout/reset/revoca assegnazione: il vecchio socket non può continuare a leggere o scrivere.
- Il DM mantiene l'accesso previsto.

### P1-REG-05 — Cambio scheda

Dal DM apri scheda A, poi B, mentre un altro client aggiorna A.

Atteso: l'aggiornamento di A non modifica né sostituisce B.

## Suite automatica

Copertura preparata:

| Area | File | Casi | Regressioni protette |
| --- | --- | ---: | --- |
| Regole combattimento | `tests/rules/character-combat-rules.test.ts` | 22 | competenze per gruppo/classe e passive, riepilogo con provenienza, armi specifiche, armature/scudi, Arma del Patto per istanza, grant legacy strutturati, armi sconosciute, sinonimi Druido/Monaco, stile TWF |
| Statistiche derivate | `tests/rules/character-derived-stats.test.ts` | 8 | punteggio 0, fallback non-finiti, rank skill, bonus passivi e Percezione passiva |
| Validazione server | `tests/server/character-patch-validation.test.mjs` | 31 | allowlist, tipi e range, contratto stretto delle competenze passive, guardie server Arma del Patto, array/oggetti, campi server-owned, prototype pollution, profondita e dimensione massima |
| Riposi | `tests/server/character-rest.test.mjs` | 19 | 0/N Dadi Vita, tiro naturale, COS negativa, cap PF, recupero lungo, guardie 0 PF/24h, TS morte, immutabilita input |
| Avvio server | `tests/server/server-startup-smoke.test.mjs` | 1 | bootstrap reale in produzione su copia DB temporanea e risposta `/healthz` |
| Migrazione e backfill | `tests/database/item-weapon-classification.test.mjs` | 5 | default SQL, conservazione dati, dry-run, apply idempotente, conflitti, DB temporanei e guardia produzione |

Totale: **86 test**. Il workflow GitHub Actions `Build`, avviato manualmente, esegue la stessa suite prima della build.

Esecuzione completa P1:

```powershell
npm.cmd run test:p1
```

Modalità watch durante lo sviluppo:

```powershell
npm.cmd run test:watch
```

La suite automatica copre regole pure, validazione patch, riposi e migrazione/backfill su SQLite temporanei. Non sostituisce i casi browser multi-client, che restano necessari prima del commit.
