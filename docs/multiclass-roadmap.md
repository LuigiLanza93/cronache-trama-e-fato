# Progressione del personaggio: level-up guidato e multiclasse

Stato: **M0-M3 completati e consolidati su `dev`; prossimo incremento M4 API di progressione e proiezioni UI**.
Data: 2026-09-07.
Perimetro: personaggi giocanti, scheda, progressione, riposi, incantesimi, persistenza e UI DM/player.

## Esito esecutivo

L'obiettivo operativo prioritario e consentire un **level-up multiclasse affidabile al prossimo avanzamento reale della campagna**. Il level-up guidato monoclasse resta una milestone tecnica obbligatoria di collaudo, non un obiettivo destinato a rimandare il multiclasse: la possibilita di scegliere una nuova classe dovra riusare la stessa operazione di progressione, lo stesso storico e gli stessi resolver.

Prima del level-up vanno corretti tutti i comportamenti che renderebbero incompatibili gli upgrade successivi: scritture automatiche, persistenza concorrente, dati duplicati, PF senza storico, Dadi Vita aggregati, risorse mescolate e assenza di provenienza. Queste correzioni costituiscono un **Gate di compatibilita**: il level-up non parte finche non e superato.

Il modello nascera capace di indicare quale classe viene incrementata (`targetClassKey`). Durante la milestone monoclasse il server consentira soltanto la classe gia posseduta; appena completato quel collaudo, nello stesso percorso prioritario l'estensione multiclasse sblocchera l'aggiunta di una nuova classe senza cambiare contratto, storico o struttura dei PF.

### Avanzamento propedeutico verificato al 2026-08-13

I pacchetti P0 e P1 della scheda sono completati, testati, committati e pushati su `dev` (`fc0d5a8`, `f7e1837`): niente piu scritture automatiche di PF, Dadi Vita o slot all'apertura; mutazioni per personaggio seriali, validate e versionate; riposi coordinati con le patch; ACK dopo commit; room, riconnessioni e revoche Socket consolidate. Inventario/equipaggiamento e TS morte aggiornano correttamente le viste realtime; regole centrali di armi, TWF, riposi, skill/percezione e punteggio zero hanno test dedicati.

La verifica fresca del checkpoint M2/M3, eseguita il 2026-09-07, ha confermato 148/148 test P1/Gate, build di produzione, Prisma validate, sintassi server/script, TypeScript della configurazione Vite e dry-run M3 senza scritture. Il controllo corretto del progetto applicativo (`tsc -p tsconfig.app.json`) resta invece rosso per errori distribuiti in componenti e tipi preesistenti al checkpoint e deve essere chiuso come lavoro dedicato. Il DB locale di sviluppo contiene il catalogo versionato e una `CharacterClass` coerente per tutti i 6 personaggi; Railway non e stato modificato. Questo consente di chiudere M2/M3 come fondazione compatibile, ma il Gate 1.8A resta incompleto: API autorevoli, storico dei livelli, PF/Dadi Vita per classe e pool di risorse separati sono ancora da implementare.

M0 e completato. Anche M1 e ora coperto da test SQLite deterministici per FIFO, retry, conflitto, rollback multi-PG, revoca accodata e interazione patch/riposo. Riposi roster e conversione slot usano request ID e receipt durevoli in `AppState`, scritte nello stesso confine transazionale e riutilizzabili dopo restart entro il TTL. Il collaudo browser del 2026-08-14 ha confermato riposi, roster, realtime, persistenza e conversione: quando i PF cambiano mentre il dialog e aperto, la dashboard puo ricevere la revisione live e applicare coerentemente il riposo sui nuovi valori, senza lost update. M2 e completato nel layer puro: contratto condiviso, 12 chiavi classe stabili, prerequisiti, Dadi Vita, profili caster, sottoclassi baseline SRD, tabelle slot Spellcasting/Pact Magic e preview before/after con `targetClassKey`. M3 aggiunge schema e backfill versionati, dual-read shadow conservativo e guardia sull'importatore storico distruttivo; UI, REST e Socket restano invariati. Il prossimo incremento e M4.

La baseline M0 locale, il decision record confermato, la matrice consumer e i casi attesi sono raccolti in [`multiclass-m0-baseline.md`](./multiclass-m0-baseline.md). D0 usa le regole gia implementate come house rule e SRD 5.1/2014 come fallback per i vuoti. I PF di ogni level-up usano il Dado Vita pieno della classe incrementata + COS; i riposi seguono la house rule storica con due brevi tra lunghi e cura automatica a media fissa.

Il DB locale storico non contiene `_prisma_migrations`, quindi `prisma migrate status` non puo certificarne la cronologia. Lo schema effettivo e il DB risultano validi e integri, ma M3 deve introdurre una procedura tracciabile, additiva e restart-safe. La migrazione P1 delle armi non e applicata a Railway e andra inclusa in un futuro rilascio controllato con backup fresco; cio non blocca il lavoro su `dev`.

La scelta della sottoclasse fa gia parte del level-up monoclasse: ogni classe sceglie la propria sottoclasse quando raggiunge il livello previsto dal ruleset. L'automazione completa dei privilegi resta successiva.

Non e sicuro:

- concatenare classi in `basicInfo.class`, per esempio `Guerriero 5 / Mago 3`;
- aggiungere un array soltanto dentro `Character.data`;
- derivare i PF usando un unico Dado Vita per il livello totale;
- fondere Spellcasting e Pact Magic nello stesso pool;
- applicare il multiclasse tramite patch Socket generiche;
- reinterpretare automaticamente feature e incantesimi testuali esistenti.

## Obiettivi

1. Stabilizzare la scheda e rimuovere le incompatibilita prima di automatizzare la progressione.
2. Realizzare e collaudare come milestone un level-up guidato monoclasse atomico, con anteprima, storico e sottoclassi.
3. Conservare il livello totale come somma verificabile dei livelli di classe, anche quando inizialmente esiste una sola classe.
4. Calcolare correttamente bonus competenza, PF, Dadi Vita e progressione da incantatore.
5. Separare Spellcasting, Pact Magic e risorse non magiche.
6. Completare il percorso prioritario estendendo il level-up alla scelta di una nuova classe prima del prossimo avanzamento reale della campagna.
7. Preservare senza perdita schede e dati legacy.
8. Consentire opzioni manuali e house rule senza confonderle con regole canoniche.

## Non obiettivi della milestone monoclasse

- assegnazione automatica universale dei privilegi concessi dalle sottoclassi;
- validazione di ogni talento, variante o contenuto personalizzato;
- migrazione automatica delle feature testuali;
- rollback arbitrario dopo che il personaggio e stato giocato;
- rimozione immediata di `Character.className`, `Character.level` o dei campi JSON legacy;
- supporto simultaneo e implicito a regole 2014 e 2024.
- aggiunta immediata di una seconda classe durante il solo collaudo monoclasse: il contratto la prevede e il server la abilita nella milestone multiclasse immediatamente successiva.

## Stato attuale e criticita

### Identita e persistenza

`Character` conserva una sola `className` e un solo `level`. Gli stessi valori sono duplicati in `Character.data.basicInfo` e le colonne SQLite prevalgono in lettura.

Implicazioni:

- una stringa composta romperebbe lookup e normalizzazioni;
- non esistono classe primaria, livello per classe o sottoclasse;
- non si puo imporre `livello totale = somma livelli di classe`;
- `character:update` non valida tipi, range o transizioni di progressione.

### PF e Dadi Vita

La scheda deduce un solo Dado Vita dalla classe e ricalcola i PF massimi applicandolo al livello totale. Il riposo conserva un solo conteggio di Dadi Vita residui.

Per un `Mago 3 / Guerriero 2` servono invece:

- tre Dadi Vita d6 e due d10;
- residui distinti per taglia;
- PF acquisiti livello per livello o un override manuale esplicito;
- la house rule confermata del Dado Vita pieno della classe incrementata + COS, con storico e adeguamenti COS tracciati.

Il ricalcolo automatico all'apertura e bloccante: puo sovrascrivere PF e Dadi Vita validi senza conferma.

### Spellcasting e risorse

`combatStats.spellSlots` e un contenitore unico. Il comportamento varia in base alla stringa della classe e il modello e riutilizzato anche per risorse che non sono slot, come le manovre del Guerriero.

Mancano:

- livello effettivo da incantatore multiclass;
- classificazione full/half/third/Pact/non-caster;
- pool Pact Magic separato;
- profili di lancio distinti per classe e caratteristica;
- provenienza strutturata degli incantesimi;
- distinzione tra massimo derivato, stato consumato e override.

La conversione house-rule deve operare solo sul pool Spellcasting.

### Competenze, privilegi e incantesimi

Le competenze non registrano la provenienza: non si distingue la classe iniziale dall'ingresso successivo in una classe. Gli incantesimi sono spesso feature testuali con classe e livello nel nome. Questo formato va preservato come legacy, non usato per backfill automatici.

### Scritture e concorrenza

La pipeline corrente e versionata e seriale per slug; patch, riposi e conversioni condividono il coordinatore e le operazioni retry-safe usano receipt durevoli. Restano da progettare per la progressione le scritture su piu tabelle e le proiezioni legacy con un unico writer.

La progressione deve essere un comando transazionale dedicato.

## Gate D0: decisioni di prodotto e regole

Il modello base puo essere preparato prima, ma l'automazione non deve iniziare finche queste decisioni non sono chiuse.

| Decisione | Opzioni | Raccomandazione iniziale |
| --- | --- | --- |
| Ruleset | **Confermato:** regole esistenti come house rule; SRD 5.1/2014 per cio che manca; conflitti risolti esplicitamente |
| Autorita | **Confermato:** V1 solo DM |
| Prerequisiti | **Confermato:** standard con override DM motivato e storicizzato |
| Ambito V1 | **Confermato:** guidato; automatizzare solo derivati affidabili |
| PF | **Confermato:** a ogni level-up Dado Vita pieno della classe incrementata + COS; valore e provenienza registrati |
| Riposi | **Confermato:** house rule storica, massimo due brevi, cura automatica media fissa + COS, lungo ripristina tutti i Dadi Vita |
| Classi custom | **Confermato:** fallback manuale chiaramente marcato |
| Sottoclassi | **Confermato:** ogni classe usa la propria soglia regolamentare; privilegi automatici rinviati |
| Classe primaria | **Confermato:** prima classe acquisita, non ordinamento UI |

La soglia non deve essere codificata globalmente. `subclassSelectionLevel` appartiene alla regola della singola classe e deve provenire dal ruleset/versione scelto. In un personaggio multiclasse si considera sempre `classLevel(classKey)`, mai il livello totale del personaggio.

## Architettura target

```text
Catalogo regole versionato
  -> classi, Dadi Vita, profili caster e prerequisiti

Progressione personaggio
  -> classi, livelli, sottoclassi e storia delle scelte

Resolver puri
  -> livello totale, PB, Dadi Vita e slot attesi

Stato consumabile
  -> Dadi Vita e slot usati, separati dai massimi

Override e house rule
  -> provenienza, motivazione e valore effettivo

Proiezione legacy
  -> className/level/basicInfo per i consumer non ancora migrati
```

### Modello dati minimo

I nomi definitivi saranno validati nella fase schema.

#### `ClassRule`

- chiave stabile non localizzata, etichetta e alias;
- ruleset, versione e riferimento della fonte;
- taglia Dado Vita;
- tipo caster e contributo multiclass;
- caratteristica da incantatore;
- prerequisiti;
- livello di scelta della sottoclasse previsto dal ruleset;
- flag custom/manuale.

#### `SubclassRule`

- chiave stabile, etichetta e alias;
- riferimento alla classe di appartenenza;
- ruleset, versione, fonte e flag custom/manuale;
- disponibilita/archiviazione;
- eventuali metadati dei privilegi, senza obbligare la V1 ad automatizzarli.

#### `CharacterClass`

- personaggio e `classRuleKey`;
- livello di classe;
- sottoclasse opzionale;
- ordine e classe primaria;
- autore e timestamp modifica.

Vincoli:

- una riga per classe/personaggio;
- una sola primaria;
- livello classe 1-20;
- somma livelli 1-20.

Regole sottoclasse:

- sotto `ClassRule.subclassSelectionLevel`: nessuna sottoclasse selezionabile;
- quando un incremento raggiunge la soglia della classe: la preview richiede una sottoclasse per quella classe;
- dalla soglia in avanti: esattamente una sottoclasse per classe, salvo stato legacy esplicitamente incompleto;
- la sottoclasse scelta deve appartenere alla relativa `ClassRule`;
- classi custom possono usare una `SubclassRule` custom o un valore manuale strutturato;
- cambiare sottoclasse non e un normale level-up e richiede una futura procedura di riqualificazione/override DM dedicata.

La classe primaria rappresenta la prima classe acquisita: determina regole iniziali come PF del primo livello e competenze di partenza. Cambiarla dopo la creazione non e un riordino innocuo e deve richiedere una futura procedura di ricostruzione/override, non un toggle libero.

#### `CharacterLevelHistory`

- livello totale risultante e classe incrementata;
- metodo PF e PF ottenuti;
- snapshot delle scelte;
- ruleset/policy;
- autore, timestamp e motivazione override.

Non e event sourcing completo: serve a ricostruire la progressione ed evitare ricalcoli distruttivi.

#### `CharacterHitDiePool`

- personaggio e taglia dado;
- totale derivato/confermato;
- quantita residua;
- override esplicito opzionale.

#### Pool risorse

- `SPELLCASTING` condiviso secondo il livello effettivo caster;
- `PACT_MAGIC` secondo il livello Warlock;
- `CLASS_RESOURCE` per manovre e risorse analoghe;
- `MANUAL` per casi custom.

Ogni pool dichiara origine, reset e stato consumato. I massimi derivati non vanno confusi con lo stato corrente.

#### Fasi successive

`CharacterSpell` dovra registrare incantesimo, profilo/classe sorgente, caratteristica, acquisizione e stato conosciuto/preparato. `CharacterProficiency` dovra registrare tipo, soggetto, rank e provenienza.

### Compatibilita legacy

Durante la transizione:

- `Character.level` = somma di `CharacterClass.level`;
- `Character.className` = classe primaria;
- `basicInfo.level/class` derivano dalla stessa proiezione;
- le API nuove espongono anche `classes[]` e `totalLevel`;
- i vecchi consumer continuano a leggere le proiezioni;
- nessun consumer puo scrivere direttamente le proiezioni dopo l'attivazione del nuovo modello.

## Roadmap esecutiva

Le fasi indicano dipendenze, non automaticamente numeri di versione.

### Gate di compatibilita pre-level-up

Il Gate e superato soltanto quando M0-M6 garantiscono che il primo level-up non introduca dati o API da rifare per il multiclasse.

Requisiti obbligatori:

1. nessuna apertura della scheda scrive o ricalcola automaticamente PF, Dadi Vita o slot;
2. tutte le mutazioni core sono validate, serializzate e confermate dopo il commit;
3. livello totale, livello di classe e livello caster sono concetti distinti;
4. ogni aumento di livello indica sempre `targetClassKey`, anche se esiste una sola classe;
5. PF guadagnati e scelte sono registrati per singolo livello;
6. Dadi Vita sono attribuiti alla classe/taglia corretta;
7. massimi derivati e stato consumato delle risorse sono separati;
8. Spellcasting, Pact Magic e risorse di classe non condividono un contenitore ambiguo;
9. sottoclassi e relative soglie sono dati strutturati del ruleset;
10. le proiezioni legacy hanno un solo writer e non possono divergere dal nuovo modello;
11. preview e apply usano lo stesso resolver e una revisione attesa;
12. esistono test automatici per persistenza, retry, conflitto e rollback transazionale.

Non e necessario, prima del level-up monoclasse, automatizzare ogni privilegio o incantesimo. E invece necessario che ogni elemento manuale abbia provenienza e non venga cancellato da ricalcoli futuri.

### M0 - Decisioni e baseline

**Obiettivo:** chiudere le regole e creare una baseline prima di cambiare dati.

Interventi:

1. Chiudere il Gate D0.
2. Aggiornare l'audit distinguendo problemi presenti da quelli mitigati dopo luglio.
3. Censire in sola lettura:
   - classe/livello in colonne e JSON;
   - valori mancanti o divergenti;
   - classi custom e alias;
   - forme reali di slot, Dadi Vita, feature e incantesimi.
4. Preparare fixture monoclasse e multiclass su dati disposable.
5. Congelare i contratti legacy da mantenere.

Deliverable: decision record, rapporto qualita dati, matrice consumer e suite casi attesi.

**Uscita:** nessuna decisione bloccante; ogni forma dati nota ha una strategia.

### M1 - Stabilizzazione core scheda

**Stato:** completato, collaudato manualmente e consolidato su `dev` in `c9e64f8` il 2026-08-14.

**Obiettivo:** impedire che apertura, concorrenza o errori alterino la progressione.

Interventi:

1. Rimuovere scritture automatiche di PF, Dadi Vita e slot dai `useEffect`.
2. Separare anteprima da applicazione esplicita.
3. Introdurre revisione e validazione server dei campi core.
4. Serializzare per personaggio patch, riposi e conversioni.
5. Restituire ack dopo commit e gestire revisioni obsolete.
6. Correggere lifecycle room e rivalidazione sessioni Socket prevista dall'audit.
7. Aggiungere test automatici di concorrenza/persistenza.

**Uscita:** apertura senza scritture; nessun overwrite silenzioso; riposo non annullabile da patch pendente; client consapevole di salvataggio/conflitto/errore.

### M2 - Contratto e catalogo classi

**Stato:** completato il 2026-08-15 in `shared/character-class-rules.mjs` con dichiarazioni TypeScript e 31 test. M2.1 ha introdotto chiavi/alias, fonte/versione, prerequisiti, totale e livello per classe, PB, pool Dadi Vita, contributi full/half/third, Pact Magic separata, soglie sottoclasse e fallback manuale. M2.2 ha completato caratteristica e soglia di lancio data-driven, sottoclassi baseline SRD piu i due third-caster 2014 con provenienza distinta, progressioni massime Spellcasting/Pact Magic e preview pura di avanzamento. La preview richiede `targetClassKey`, non muta gli input, distingue incremento/nuova classe, cap 20, scelta sottoclasse, invalidita e casi custom/manuali; resta manuale se qualsiasi classe coinvolta ha regole irrisolte e non applica ancora policy o prerequisiti MC. Nessuna API, UI, migrazione o scrittura `Character.data` e stata introdotta.

**Obiettivo:** definire chiavi, tipi e resolver indipendenti dalla UI.

Interventi:

1. Tipi condivisi per classi, livello totale, caster, Dadi Vita e override.
2. Chiavi stabili separate da etichette italiane/inglesi.
3. Catalogo per Dado Vita, prerequisiti, tipo/contributo caster, caratteristica, fonte/versione e sottoclassi associate.
4. Resolver puri e testati per totale, PB, pool Dadi Vita e progressioni monoclasse; definire fin da ora gli input plurali necessari al futuro livello caster multiclass.
5. Resolver di eleggibilita sottoclasse basato sulla soglia della singola `ClassRule`.
6. Fallback per classi e sottoclassi custom.

Il contratto deve distinguere esplicitamente:

- `characterLevel`: somma di tutti i livelli, usata per PB e gli effetti che scalano sul livello totale;
- `classLevel(classKey)`: usato per privilegi, sottoclassi e avanzamenti della singola classe;
- `effectiveCasterLevel`: usato esclusivamente per la tabella slot Spellcasting multiclass;
- `pactMagicLevel`: livello Warlock, indipendente dallo Spellcasting condiviso.

**Uscita:** server e client producono gli stessi derivati monoclasse; nessun resolver usa stringhe visuali concatenate; il contratto accetta livelli per classe senza abilitare ancora combinazioni nell'applicazione.

### M3 - Schema additivo e backfill monoclasse

**Stato:** completato localmente il 2026-08-15. Migrazione e backfill sono additivi, transazionali, idempotenti e verificati sul DB locale: 12 `ClassRule`, 14 `SubclassRule`, 6 `CharacterProgression` e 6 `CharacterClass`, senza divergenze. Il server usa il modello soltanto come shadow interno quando schema, snapshot e vincoli sono completi; in ogni altro caso conserva la lettura legacy con diagnostica. Payload REST/Socket e writer legacy restano invariati fino a M4. Railway non e stato toccato. Procedura e confini sono descritti in [`character-progression-m3.md`](./character-progression-m3.md).

**Obiettivo:** introdurre il modello senza cambiare comportamento visibile.

Interventi:

1. Aggiungere `ClassRule`, `SubclassRule`, `CharacterClass` e revisione necessaria.
2. Migrazione additiva/restart-safe.
3. Backfill idempotente di una classe per ogni personaggio.
4. Report esplicito delle divergenze colonne/JSON; nessuna correzione ambigua.
5. Dual-read e proiezioni legacy.
6. Aggiornare o ritirare l'importatore JSON distruttivo.
7. Applicare e verificare sul DB locale.

Fino alla fase multiclasse, il dominio consente al massimo una `CharacterClass` per personaggio. La struttura e gia plurale per compatibilita futura, ma l'aggiunta di una seconda riga viene rifiutata dal servizio applicativo.

**Uscita:** una `CharacterClass` per ogni monoclasse; somma coerente con proiezioni; UI invariata; riesecuzione senza duplicati.

Produzione: nessuna applicazione Railway senza autorizzazione; backup fresco, conteggi e rollback; mai `prisma db push`.

### M4 - API di progressione e proiezioni UI

**Obiettivo:** introdurre il contratto di progressione e le proiezioni senza abilitare ancora il multiclasse.

Interventi:

1. Serializer con `classes[]`, primaria e `totalLevel`.
2. Endpoint dedicati preview/apply.
3. Validazione ownership, ruolo, revisione, limite 20, duplicati e prerequisiti.
4. Transazione unica per classi, storico e proiezioni.
5. Formatter condiviso in header, home, roster, assegnazioni, dashboard, tracker e identikit.
6. Rendere non scrivibili direttamente i vecchi campi.

Ogni richiesta di progressione include `targetClassKey`. Nel level-up monoclasse deve coincidere con l'unica classe posseduta; la fase multiclasse riusera lo stesso campo per indicare una classe nuova o una classe esistente.

**Uscita:** tutte le superfici leggono la nuova proiezione monoclasse; nessun writer crea divergenze; preview/apply coincidono a revisione invariata. I formatter sono gia capaci di ricevere piu classi, ma tale stato non e ancora creabile.

La preview deve impedire la conferma del livello che raggiunge o supera la soglia regolamentare della classe senza una sottoclasse valida. Per personaggi legacy gia oltre la propria soglia ma privi di sottoclasse, il backfill non deve inventarne una: espone uno stato incompleto che il DM risolve esplicitamente.

### M5 - PF, Dadi Vita e riposi

**Obiettivo:** gestire taglie diverse senza sovrascrivere valori storici.

Interventi:

1. Storico livelli/guadagni PF e pool per taglia.
2. Migrare conservando PF correnti/massimi come valori effettivi.
3. Usare stato `legacy/manuale` quando lo storico non e ricostruibile.
4. Level-up con Dado Vita pieno della classe incrementata + COS e registrazione dell'incremento.
5. Riposi DM capaci di consumare automaticamente i pool corretti secondo la house rule.
6. Applicare la policy definitiva del recupero lungo.
7. UI senza ricalcoli impliciti.

Il primo livello usa la regola della classe iniziale; prendere successivamente il primo livello in una nuova classe non deve essere trattato come un nuovo “livello 1” con PF massimi del dado.

**Uscita:** d6/d8/d10/d12 distinti; riposo e refresh non alterano dati inattesi; cambio COS segue policy esplicita.

### M6 - Spellcasting, Pact Magic e risorse

**Obiettivo:** correggere slot e recuperi monoclasse con un modello che non debba essere sostituito dal multiclasse.

Interventi:

1. Pool distinti con massimo/usato.
2. Spellcasting monoclasse con massimo derivato separato dallo stato consumato.
3. Pact Magic come pool autonomo dal solo livello Warlock.
4. Manovre e altre risorse fuori dagli slot.
5. Riposi basati su `resetPolicy`, non nome classe.
6. Conversione house-rule limitata a Spellcasting.
7. UI con pool separati.
8. Profili di lancio associati alla classe, pronti a coesistere ma inizialmente usati da una sola classe.

**Uscita:** caster monoclasse e Warlock hanno pool/reset corretti; nessun truncamento all'apertura o level-up; aggiungere un secondo pool o un livello caster combinato non richiedera cambiare lo schema dello stato consumato.

### L1 - Level-up guidato monoclasse

**Obiettivo:** rendere utilizzabile e collaudare la progressione prima di abilitare una seconda classe.

UX:

1. Azione `Aumenta livello` sulla classe posseduta.
2. Anteprima prima/dopo di livello, PB, PF, Dadi Vita, slot, risorse e scelte.
3. Scelta obbligatoria della sottoclasse quando la classe raggiunge la soglia del ruleset.
4. Evidenza delle opzioni automatizzate e dei passaggi manuali.
5. Override DM motivato dove previsto.
6. Conferma atomica e gestione conflitti.

Perimetro iniziale:

- solo DM;
- una sola `CharacterClass` incrementabile;
- `targetClassKey` obbligatorio e coincidente con la classe posseduta;
- automazione di livello totale, PB, PF, Dadi Vita e risorse supportate;
- sottoclasse strutturata alla soglia corretta;
- competenze, privilegi e incantesimi non ancora censiti come passaggi manuali preservati;
- storico sempre registrato.

**Uscita:** il DM porta un personaggio monoclasse al livello successivo senza modificare campi grezzi; sottoclasse e derivati sono coerenti; il player riceve il risultato realtime; errore o conflitto lascia lo stato precedente.

### MC1 - Estensione multiclasse del level-up

**Obiettivo:** aggiungere al flusso collaudato la scelta tra avanzare una classe posseduta e prendere il primo livello in una nuova classe.

Interventi:

1. Sbloccare piu righe `CharacterClass` nel servizio applicativo.
2. Estendere la preview con `ADVANCE_EXISTING_CLASS | ADD_NEW_CLASS`.
3. Validare prerequisiti della classe attuale e della nuova classe secondo il ruleset.
4. Applicare competenze concesse dall'ingresso multiclass, distinte da quelle della classe iniziale.
5. Applicare il Dado Vita e i PF del nuovo livello senza trattarlo come primo livello del personaggio.
6. Calcolare livello totale, class level, effective caster level e Pact Magic senza cambiare i contratti L1.
7. Gestire sottoclassi indipendenti quando ciascuna classe raggiunge la propria soglia.
8. Applicare regole di cumulo/non cumulo dei privilegi censiti.
9. Aggiornare formatter e viste con tutte le classi e sottoclassi.

**Uscita:** lo stesso comando usato da L1 puo avanzare una classe esistente o aggiungerne una nuova; nessuna migrazione dei record di storico L1 e nessuna riscrittura di PF, slot o API e necessaria.

### M8 - Incantesimi, competenze e privilegi strutturati

Questa fase puo iniziare per il monoclasse prima di MC1, ma gli aspetti specifici dell'ingresso multiclass devono essere completati prima di dichiarare conclusa MC1.

1. Normalizzare incantesimi e profili di lancio.
2. Distinguere conosciuti, preparati, sempre preparati e manuali.
3. Normalizzare competenze, rank e provenienza.
4. Censire concessioni dell'ingresso multiclass.
5. Collegare privilegi/sottoclassi a regole versionate.
6. Migrazione assistita, mai silenziosa, delle feature testuali.
7. Estendere preview e storico.

Il censimento include le regole di cumulo: privilegi come Attacco Extra non vanno sommati automaticamente, mentre risorse e scaling possono dipendere da class level, character level o eccezioni.

**Uscita:** nessun parsing del titolo per determinare la classe; CD/profili e competenze hanno provenienza verificabile.

### M9 - Player e automazione avanzata

Possibili estensioni:

- richiesta player approvata dal DM;
- catalogo privilegi/sottoclassi piu completo;
- suggerimenti incantesimi;
- correzione guidata della progressione;
- rollback limitato all'ultima operazione non ancora usata.

M9 non e requisito per level-up monoclasse o MC1 guidati dal DM.

## Dipendenze

```text
M0 Decisioni/baseline
        |
        v
M1 Stabilita scheda ------> M2 Contratto/resolver
        |                         |
        +------------+------------+
                     v
              M3 Schema/backfill
                     |
                     v
              M4 API/proiezioni
                 /         \
                v           v
          M5 PF/Dadi      M6 Magia/risorse
                \           /
                 +----+-----+
                      v
              L1 Level-up monoclasse
                      |
                      v
              MC1 Multiclasse
                 /          \
                v            v
     M8 Contenuti strutturati  M9 Automazione/player
```

M5 e M6 possono procedere in parallelo dopo M4 con responsabilita disgiunte. L1 dipende dal Gate pre-level-up completo. MC1 dipende da L1 collaudato e dalle parti di M8 necessarie a competenze, privilegi e incantesimi del multiclasse.

## Migrazione e rilascio

### Locale

1. Migrazioni additive.
2. Allineamento di `prisma/migration.db` allo schema `dev`.
3. Backfill soltanto sul DB locale o copie disposable.
4. Verifica di idempotenza, conteggi, FK e invarianti.
5. Fixture pre/post migrazione.

### Compatibilita

Approccio expand/migrate/verify/contract:

1. **Expand:** nuove tabelle/API, vecchi campi presenti.
2. **Migrate:** backfill e adozione del nuovo writer.
3. **Verify:** confronti tra proiezioni, dati e viste.
4. **Contract:** rimozione writer legacy in una release successiva.

La rimozione fisica di colonne o JSON non appartiene ne al primo level-up ne a MC1.

### Railway

Per ogni release con schema/backfill:

1. autorizzazione esplicita;
2. backup Railway fresco e verificato;
3. preflight di commit, migrazioni e working tree;
4. merge `dev` -> `main` con `--no-ff`;
5. SQL additivo/restart-safe, mai `prisma db push`;
6. verifica conteggi, FK, totale e proiezioni;
7. deploy dell'esatto tip di `main`;
8. smoke autenticato DM/player;
9. riallineamento di `dev` al `main` distribuito.

## Piano di test minimo

### Dati/migrazioni

- monoclasse normale, dati mancanti/divergenti, alias e classe custom;
- riesecuzione senza duplicati;
- integrita FK e conteggi prima/dopo;
- rollback applicativo con nuove tabelle presenti.

### Resolver

- livelli totali sulle soglie PB;
- combinazioni Dadi Vita;
- full+full, full+half, full+third, half+half;
- Warlock+caster;
- prerequisito superato, fallito e override DM;
- classe custom manuale.
- classe sotto soglia senza sottoclasse, passaggio alla soglia con scelta obbligatoria e personaggio legacy oltre soglia incompleto;
- due classi con soglie differenti e sottoclassi indipendenti;
- rifiuto di una sottoclasse appartenente a un'altra classe.

### PF/riposi

- Dado Vita pieno della classe incrementata e COS negativa/positiva, inclusi adeguamenti retroattivi;
- pool di taglie diverse e recupero lungo;
- refresh/due client durante riposo;
- policy cambio COS.

### Slot/risorse

- massimo e usato per pool;
- riposi breve/lungo;
- conversione solo Spellcasting;
- Pact Magic e manovre indipendenti;
- conflitto/retry.

### Sicurezza/realtime

- player non owner e owner;
- V1 modificabile solo dal DM;
- revisione obsoleta e doppia conferma;
- fallimento transazione senza scritture parziali;
- due browser, cambio scheda e revoca sessione.

### UI

- mono/multiclasse in tutte le viste;
- desktop e 320/360/390 px;
- tastiera/focus dialog;
- errori per riga, preview e stati salvato/conflitto/retry.

## Rischi

| Rischio | Impatto | Mitigazione |
| --- | --- | --- |
| PF/slot alterati aprendo la scheda | Critico | M1 prima della UI; nessuna scrittura da effect |
| Divergenza nuovo modello/legacy | Alto | Un solo writer e invarianti server |
| Migrazione ambigua | Alto | Backfill conservativo e stato manuale |
| Pact Magic fusa con Spellcasting | Alto | Pool distinti prima del level-up |
| Ruleset/house rule mescolati | Alto | Gate D0 e policy versionate |
| Feature attribuite male | Medio-alto | Migrazione assistita in M8 |
| Combinazioni non censite | Medio | Fallback manuale e warning |
| Scope eccessivo | Alto | Prima L1 monoclasse, poi MC1; contenuti avanzati in M8/M9 |
| Release DB non reversibile | Critico | Schema additivo e backup Railway |

## Stima relativa

| Fase | Taglia | Rischio | Gate |
| --- | --- | --- | --- |
| M0 | S | Medio | Decisioni e baseline accettate |
| M1 | L | Critico | Test concorrenza e scheda |
| M2 | M | Alto | Review regole e resolver |
| M3 | M-L | Critico | DB locale, idempotenza, security review |
| M4 | M-L | Alto | API/realtime e viste |
| M5 | L | Alto | PF/riposi e legacy |
| M6 | XL | Critico | Matrice caster/Pact/risorse |
| L1 | L | Alto | Test level-up monoclasse DM/player end-to-end |
| MC1 | L-XL | Critico | Matrice combinazioni multiclasse end-to-end |
| M8 | XL | Alto | Migrazione assistita/cataloghi |
| M9 | Variabile | Medio-alto | Decisione basata sull'uso reale |

## Definizione di completamento L1

1. Le schede monoclasse restano invariate dopo migrazione, apertura e restart.
2. Il DM incrementa l'unica classe tramite preview e commit atomico.
3. La sottoclasse viene richiesta alla soglia regolamentare della classe.
4. Totale, PB, PF, Dadi Vita e pool magici sono coerenti.
5. Spellcasting, Pact Magic e risorse di classe hanno stati distinti.
6. Riposi e conversione toccano soltanto i pool pertinenti.
7. Le viste principali mostrano classi e relative sottoclassi.
8. Il player non puo forzare modifiche tramite API/Socket.
9. Errori e conflitti non lasciano scritture parziali.
10. Passaggi manuali e override sono visibili e tracciati.
11. Migrazione, rollback applicativo, backup e verifiche Railway sono documentati.

## Definizione di completamento MC1

1. L1 continua a funzionare senza migrare storico o contratti.
2. Il DM sceglie se avanzare una classe esistente o aggiungerne una nuova.
3. Prerequisiti e concessioni multiclass sono validati dal ruleset.
4. PF e Dadi Vita registrano il nuovo livello sulla classe corretta.
5. Spellcasting, Pact Magic e risorse rimangono separati e coerenti.
6. Ogni classe gestisce la propria sottoclasse alla relativa soglia.
7. Regole di cumulo censite non producono duplicazioni illegittime.
8. Tutte le viste e il realtime mostrano la nuova composizione.
9. Errori, retry e conflitti non lasciano progressioni parziali.

## Primo incremento consigliato

Il primo sviluppo non deve ancora aggiungere la seconda classe:

1. aggiornare l'audit allo stato attuale;
2. rimuovere scritture automatiche di PF/Dadi Vita e slot;
3. introdurre pipeline versionata con ack;
4. aggiungere test concorrenti;
5. registrare le decisioni su ruleset, riposi e autorita V1.

Completato questo pacchetto, si potranno introdurre `ClassRule` e `CharacterClass` senza costruire sopra una persistenza fragile.
