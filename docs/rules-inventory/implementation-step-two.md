# Creazione guidata: modello e persistenza delle scelte

## Consolidamento su dev — 2026-10-07

L'utente ha autorizzato commit e push su `origin/dev` anche senza collaudo
manuale, per consolidare codice, documentazione e configurazione del progetto
prima della ristrutturazione dei file. Le verifiche automatiche sotto restano
quelle eseguite il 2026-10-02; non sono state ripetute per il consolidamento.
Il collaudo browser e le scelte complete dei livelli 2–20 rimangono aperti.
Questo consolidamento non è un rilascio in produzione.

## Checkpoint di implementazione

Checkpoint locale su `dev`, **2026-10-02**, modifiche non committate.
Questo documento aggiorna il [primo incremento](implementation-step-one.md).

## Incremento implementato

- Preview autorevole `POST /api/characters/guided/preview`, con versione del
  resolver e hash delle scelte e dei risultati. Il riepilogo del wizard usa la
  preview; l'applicazione rifiuta una preview superata.
- Evento iniziale, decisioni e concessioni nelle tabelle dedicate
  `CharacterRuleEvent`, `CharacterRuleDecision`, `CharacterRuleGrant`.
  Creazione, inventario, progressione, risorse e diario sono salvati nella
  stessa transazione. I retry conservano ricevuta e controlli di ownership.
- Ogni concessione conserva fonte e definizione usata. Una competenza concessa
  da due origini mantiene entrambe le provenienze senza sommare due volte il
  bonus. Razza, sottorazza, dominio, classe, talento e background restano distinti.
- I PG precedenti mantengono i loro snapshot: `EVENT_V1`, `SNAPSHOT_ONLY` e
  `LEGACY_UNKNOWN` distinguono lo stato documentabile. Nessun backfill inventa
  le scelte dei personaggi già creati. `Character.data` resta legacy.
- Background personalizzato: nome, due abilità, due lingue/strumenti, privilegio
  e dotazione presi dai background del manuale, testo narrativo facoltativo.
  Le alternative del Marinaio/Pirata e del Nobile sostituiscono il privilegio.
- Dotazione e competenza sono scelte distinte: strumenti del Bardo e dei
  background, strumenti dell'artigiano, alternative dell'Accolito,
  Ciarlatano, Gladiatore, Marinaio e Soldato. Gli oggetti scelti conservano
  il collegamento alla decisione che li ha concessi.
- Trucchetti e magie restano nella card esistente, raggruppati per livello,
  con descrizioni, caratteristica da incantatore e modalità d'uso. La magia
  razziale non perde la propria caratteristica quando coincide con una magia
  di classe. Domini, Iniziato alla Magia e Incantatore Rituale hanno concessioni
  distinte dalla normale lista degli incantesimi conosciuti/preparati.
- Le risorse iniziali dei privilegi usano i pool della scheda. Quantità,
  dado e recupero si aggiornano dove dipendono dal livello della classe o
  dalle caratteristiche; gli usi spesi e gli override manuali sono preservati.
  Recupero Arcano usa il reset manuale perché il manuale dice una volta al giorno.
  Non vengono acquisiti automaticamente nuovi privilegi durante il level up.
- Confronto visivo con PDF p242/p270: corretti scuola di Illusione Minore,
  dimensione del suo oggetto (1,5 m) e intestazione di Resurrezione (7°, Necromanzia).
  Catalogo rigenerato: 361 magie, zero warning di metadati. Questo controllo
  mirato non certifica l'intera trascrizione OCR.

## Database locale e applicazione

Migrazione additiva: `20261002_character_rule_events`. Comandi:

```powershell
npm.cmd run creation:events:dry-run
npm.cmd run creation:events:apply-local
```

Il database locale è stato verificato e risulta già allineato; due applicazioni
consecutive hanno confermato l'idempotenza. Backup locale verificato con
`quick_check=ok` in `.backups/creation-events-20261002/`.
Conservati 13 personaggi e 5 snapshot precedenti, senza creare eventi retroattivi.
Confronto con il backup: contenuto delle 65 tabelle invariato e `quick_check=ok`.
Una violazione di foreign key preesistente rimane invariata; non è stata riparata
da questa migrazione.
Railway non è stato modificato. Il writer delle nuove creazioni richiede lo
schema del diario; i retry delle ricevute storiche restano compatibili.

## Verifica e collaudo

- Suite P1 completa: 30 file, 259 test superati. Due regressioni aggiunte dopo
  l'avvio sono passate nella verifica mirata: 4 file, 25 test, totale 261 test.
- Build, TypeScript app/config, Prisma validate, sintassi server e generatore
  del catalogo `--check`: superati. Warning build: Browserslist e chunk >500 kB.
- La review indipendente ha fornito correzioni integrate; il suo giro finale
  si è interrotto per limite del servizio. Controlli finali eseguiti dal root.
- Browser e produzione non verificati; modifiche non committate.

La suite include tutti i percorsi razza/sottorazza × classe × background,
tutti i 42 talenti con requisiti soddisfatti, varianti dei background,
dotazione indipendente dalle competenze, provenienza delle magie, contatori,
preview superata, replay storico, autorizzazione e rollback transazionale.
Il completamento automatico dei percorsi verifica scelte e materializzazione;
non attesta ogni combinazione di effetti durante il combattimento.

Da collaudare nel browser prima della finalizzazione:

1. Bardo/Intrattenitore: competenze e strumenti posseduti diversi, magie per livello,
   pool Ispirazione e dettaglio dei privilegi.
2. Chierico: dominio, magie sempre preparate, risorse del dominio e fonte corretta.
3. Umano variante: talenti con magie/strumenti/caratteristiche e scelte annidate.
4. Background personalizzato, Pessima Fama e Servitù: un solo privilegio corretto,
   dotazione e competenze separate, testo narrativo nella scheda.
5. Ladro con competenza duplicata: conflitto spiegato e alternativa disponibile.
6. Warlock: patroni italiani, lista ampliata, nessuna Lama del Patto al livello 1.

## Fase successiva e limiti

Il modello conserva l'acquisizione iniziale e prepara gli eventi successivi.
Restano da implementare le definizioni eseguibili e il percorso completo dei
livelli 2–20: nuovi privilegi, ASI/talenti, magie, sostituzioni, Doni del Patto,
suppliche, metamagie e scelte delle sottoclassi. Preparazione dopo riposo e
copie nel libro richiedono eventi espliciti ulteriori.

La creazione usa dotazioni iniziali; l'alternativa acquisti con oro, privilegi
personalizzati scritti dal DM e suggerimenti dalle tabelle narrative non sono
nuovi flussi guidati. Non tutti gli effetti condizionali sono automatizzati.
Le house rule PF/riposi restano separate dal PHB e non sono state riscritte.
