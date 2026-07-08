# Specifica tecnica: sistema negozi sincronizzato

## Stato del documento

- Specifica funzionale e tecnica consolidata il 2026-07-03.
- Nessuna implementazione applicativa ancora avviata.
- Il documento e' il punto di ripartenza per suddividere lo sviluppo in task verificabili.

## Obiettivo

Introdurre negozi permanenti nel database e una visita sincronizzata tra DM e un solo personaggio. Il DM apre l'evento; al proprietario del personaggio compare un popup globale. Il DM vede prezzi, CD e contenuti segreti, mentre il player vede il catalogo rivelato senza prezzi e il proprio inventario affiancato.

Il sistema deve supportare compravendite negoziate, disponibilita' reale degli oggetti, saldo reale del negozio, storico delle visite, memoria specifica negozio-personaggio e movimenti atomici di inventario e monete.

## Decisioni funzionali approvate

### Visita

- Esiste una sola visita attiva in assoluto: il DM e' unico anche se narrativamente il gruppo potrebbe dividersi.
- La visita viene aperta esclusivamente dal DM per un negozio e un personaggio.
- L'apertura mostra direttamente il popup al player proprietario del PG.
- Il player non deve accettare l'ingresso, ma puo' chiudere subito la visita.
- DM e player possono entrambi chiudere la visita.
- Alla chiusura tutte le offerte pendenti decadono.
- Una visita chiusa non viene riaperta. Le note DM restano modificabili successivamente.

### Oggetti segreti

- Le prove e le CD sono gestite fuori dall'app.
- L'app mostra al DM la CD e offre un comando manuale per rivelare l'oggetto.
- Gli oggetti rivelati sono evidenziati diversamente lato player.
- La conoscenza dell'oggetto resta permanente per la coppia negozio-personaggio e vale nelle visite future.

### Sconto

- Lo sconto e' deciso fuori dall'app e registrato manualmente dal DM.
- E' una percentuale associata al personaggio per l'intera visita, per esempio Narak 15% e Aros 0%.
- Lo sconto non modifica automaticamente le offerte: il DM resta libero di proporre qualsiasi prezzo.
- La visita conserva la percentuale applicabile come memoria e contesto della trattativa.
- Come evoluzione possibile, il profilo negozio-personaggio puo' conservare anche uno sconto abituale suggerito per visite future; in V1 la fonte vincolante e' la visita corrente.

### Prezzi e offerte

- I prezzi non vengono mai inviati nel payload player finche' non fanno parte di un'offerta.
- Ogni importo e' monovaluta: rame, argento, electrum oppure oro.
- Il prezzo base dello stock e' un riferimento privato per il DM.
- Il DM puo' vendere a qualsiasi prezzo, anche superiore al listino in base al rapporto col PG.
- Il player propone liberamente il valore degli oggetti che vuole vendere; non vede una valutazione automatica.
- Il venditore formula la proposta, il compratore la accetta, la rifiuta o la rilancia.
- Finche' la trattativa non e' conclusa le proposte possono rimbalzare tra le parti.
- Accettazione e rifiuto chiudono la trattativa; un rilancio sostituisce la proposta corrente mantenendo la stessa catena negoziale.
- Prima di inviare una proposta di vendita, il player conferma oggetto, quantita' e valore in un popup.
- Prima di accettare un acquisto, il player conferma esplicitamente oggetto, quantita' e importo speso.

### Inventario e saldo

- Il negozio non puo' andare in debito.
- Il PG non puo' acquistare senza fondi sufficienti.
- Gli oggetti equipaggiati sono chiaramente marcati nell'inventario del player.
- Un oggetto equipaggiato puo' essere proposto in vendita; viene disequipaggiato solo quando la vendita viene completata.
- Le istanze non impilabili conservano override, note, cariche e stato applicabile durante il passaggio.
- Gli stack comuni vengono trasferiti per quantita'.

### Annullamenti

- Non esiste un annullamento narrativo: una compravendita volutamente conclusa si corregge con una nuova vendita o un nuovo acquisto, anche a condizioni economiche differenti.
- Resta disponibile l'annullamento tecnico DM gia' previsto dai ledger esistenti.
- L'annullamento tecnico deve essere esteso ai negozi e consentito solo se lo stato corrente permette di ripristinare coerentemente oggetti e fondi.
- L'operazione inversa deve coinvolgere insieme inventario negozio, inventario PG, saldi e registri transazionali.

## Esperienza utente

### Gestione DM permanente

Nuova sezione `/dm/shops`, raggruppata per citta', con:

- creazione, modifica e archiviazione negozi;
- nome e descrizione del negozio;
- nome e descrizione del proprietario;
- citta';
- saldo per valuta;
- inventario ricavato dal catalogo `ItemDefinition`;
- quantita', prezzo base monovaluta, segretezza e CD di scoperta;
- consultazione delle visite e del rapporto con ciascun PG;
- note private modificabili anche dopo la chiusura;
- apertura di una visita selezionando il personaggio.
- import rapido di uno o piu' negozi da JSON, con caricamento file o incolla, anteprima e conferma.

## Import rapido dei negozi da JSON

### Scopo

Il formato deve essere abbastanza stabile e descrittivo da poter essere usato come contratto di output per un progetto ChatGPT che genera negozi casuali. I file di riferimento locali sono:

- `docs/shop-import-schema.json`: JSON Schema validabile e utilizzabile nelle istruzioni del generatore;
- `docs/shop-import-example.json`: esempio completo minimo con un oggetto di catalogo e uno definito inline.

Il documento importato puo' contenere piu' negozi, anche in citta' diverse.

### Flusso UI

L'import segue lo stesso principio sicuro gia' usato per gli eventi del Diario:

1. il DM carica un `.json` oppure incolla il contenuto;
2. il client esegue il parsing e invia una richiesta `dryRun`;
3. il server valida struttura, enum, riferimenti al catalogo, slug, unicita', prezzi e quantita';
4. l'anteprima mostra negozi, prodotti, nuovi oggetti di catalogo, oggetti riusati, avvisi ed errori;
5. soltanto una conferma esplicita esegue l'import;
6. l'intero file viene applicato in una transazione: nessun import parziale se una riga fallisce.

### Struttura radice

```json
{
  "formatVersion": 1,
  "shops": []
}
```

- `formatVersion` e' obbligatorio e inizialmente vale `1`;
- `shops` e' un array non vuoto;
- campi sconosciuti sono rifiutati, cosi' gli errori di generazione non vengono ignorati silenziosamente.

### Struttura del negozio

Ogni negozio contiene:

- `externalKey`: chiave stabile in kebab-case, univoca nel file e nel DB;
- `name`, `description`, `city`;
- `owner`: oggetto con `name` e `description`;
- `balance`: saldo iniziale con `cp`, `sp`, `ep`, `gp` non negativi;
- `discountDc`: CD opzionale mostrata soltanto al DM;
- `dmNotes`: note iniziali opzionali;
- `items`: stock non vuoto.

`externalKey` serve a riconoscere import ripetuti senza affidarsi al nome, che puo' cambiare. In V1 l'import e' solo di creazione: se la chiave esiste, l'anteprima restituisce errore. Gli aggiornamenti si eseguono dalla UI; un futuro formato potra' introdurre esplicitamente modalita' `upsert`.

### Struttura del prodotto

Ogni riga stock contiene:

- esattamente uno tra `catalogSlug` e `definition`;
- `quantity` maggiore di zero;
- `price` monovaluta con `currency` e `amount` intero positivo;
- `isSecret`;
- `discoveryDc`, ammessa quando l'oggetto e' segreto;
- override opzionali `nameOverride` e `descriptionOverride`;
- `dmNotes` e `instanceNotes` opzionali;
- `data` opzionale per stato strutturato della copia;
- `featureStates` opzionale per utilizzi/cariche della singola istanza.

Con `catalogSlug` il prodotto deve gia' esistere nel catalogo e viene riusata integralmente la sua `ItemDefinition`.

Con `definition` viene creata una nuova `ItemDefinition` completa. Lo `slug` e' obbligatorio e deve essere nuovo: l'import non aggiorna mai silenziosamente una definizione esistente. Se ChatGPT vuole riusare un oggetto noto deve produrre `catalogSlug`, non ripeterne la definizione.

### Definizione oggetto inline

La definizione inline rispecchia il modello oggetti corrente e puo' includere:

- dati base, categoria, rarita', descrizione, peso, valore e attunement;
- configurazione arma, armatura e guanti;
- `slotRules`;
- `attacks`;
- `modifiers`;
- `features` attive o passive, inclusi reset, utilizzi ed effetti passivi;
- `abilityRequirements`;
- `useEffects`.

Gli array meccanici possono essere vuoti. Gli identificativi DB delle entita' annidate non sono inclusi: vengono generati dal server. `sortOrder` e' opzionale; in sua assenza deriva dalla posizione nell'array.

Per `passiveEffects` il formato V1 accetta gli stessi oggetti strutturati gestiti dall'editor attuale. Il server deve comunque passarli attraverso la medesima normalizzazione e validazione usata da `ItemManagement`, non salvarli alla cieca.

### Stato feature importato

Le righe `featureStates` identificano la feature tramite `featureName`, perche' gli ID vengono generati all'import:

```json
{
  "featureName": "Tre cariche arcane",
  "usesSpent": 1,
  "lastResetAt": null
}
```

Il nome deve corrispondere in modo univoco a una feature della definizione. Lo stato e' consentito soltanto su prodotti trattati come singole istanze (`quantity = 1`, oggetto non stackable). Un prodotto senza utilizzi consumati omette completamente `featureStates`.

### Regole di validazione semantica

Oltre al JSON Schema, il server deve verificare:

- unicita' di `externalKey` e slug nel file;
- inesistenza nel DB delle chiavi/definizioni da creare;
- esistenza di ogni `catalogSlug`;
- compatibilita' tra categoria e campi arma/armatura;
- oggetti `UNIQUE` non duplicati nel DB, negli inventari o nello stesso import;
- oggetti non stackable con `quantity = 1` per riga;
- assenza di stato per-copia sugli stack;
- corrispondenza univoca di `featureName`;
- `discoveryDc` intera e positiva quando presente;
- percentuali, saldi, prezzi e quantita' nei limiti accettati dall'app;
- normalizzazione degli slug e rifiuto delle collisioni risultanti;
- rifiuto di campi privati o ID DB forniti dal generatore.

### Istruzione consigliata per il progetto ChatGPT

Il progetto generatore dovra' ricevere `shop-import-schema.json` come contratto e produrre esclusivamente JSON valido, senza Markdown. Nelle istruzioni e' utile specificare:

> Genera uno o piu' negozi conformi al JSON Schema fornito. Usa `catalogSlug` solo per oggetti certamente esistenti nel catalogo indicato dall'utente; altrimenti crea una `definition` completa. Non inventare campi, non includere ID database e restituisci soltanto JSON.

Per usare in modo affidabile `catalogSlug`, in futuro la pagina negozi potra' esportare un piccolo indice del catalogo (`slug`, nome, categoria, rarita') da allegare al progetto ChatGPT.

### Vista DM durante la visita

Il DM vede:

- tutto lo stock, inclusi gli oggetti segreti;
- prezzi base e CD;
- saldo negozio;
- percentuale di sconto della visita;
- inventario, equipaggiamento e saldo del PG;
- oggetti gia' conosciuti dal PG;
- catene di offerte e relativo stato;
- note private e storico visite;
- comandi di rivelazione, proposta/rilancio e chiusura.

### Vista player durante la visita

Popup globale con:

- negozio e proprietario;
- stock visibile, senza listino prezzi;
- oggetti appena rivelati evidenziati;
- proprio inventario affiancato, con stato equipaggiato evidente;
- proprio saldo;
- proposta di vendita con conferma preventiva;
- offerte ricevute e possibilita' di accettare, rifiutare o rilanciare;
- comando per lasciare il negozio.

Su desktop e' preferibile una vista a colonne; su mobile una vista a tab.

## Modello dati proposto

Tutte le nuove strutture devono essere tabelle dedicate. Non aggiungere stato a `Character.data`.

## Compatibilita' completa con il sistema oggetti esistente

### Principio architetturale

Un prodotto del negozio non deve essere una versione semplificata o una copia testuale di un oggetto. Deve usare la stessa `ItemDefinition` usata dagli inventari dei personaggi e deve quindi poter mostrare e trasferire tutte le proprieta' meccaniche gia' supportate dall'app.

La separazione corretta e':

- `ItemDefinition`: descrive che cosa e' l'oggetto e quali regole possiede;
- `ShopItem`: descrive una copia o uno stock posseduto dal negozio;
- `CharacterItem`: descrive una copia o uno stack posseduto dal personaggio;
- stato feature dell'istanza: descrive utilizzi e reset della singola copia, indipendentemente dal proprietario corrente.

Non vanno duplicati dentro `ShopItem` attacchi, feature, effetti o modificatori. Duplicarli produrrebbe due versioni dello stesso oggetto e aggiornamenti incoerenti tra catalogo, negozio e inventario PG.

### Attributi oggi presenti in `ItemDefinition`

Ogni prodotto collegato al catalogo eredita i seguenti dati base:

- nome, slug, categoria e sottocategoria;
- rarita';
- descrizione;
- visibilita' generale al player;
- impilabilita';
- equipaggiabilita';
- requisito di sintonia/attunement;
- peso;
- valore indicativo in rame `valueCp`;
- eventuali dati aggiuntivi strutturati.

Categorie attualmente supportate:

- armi, armature e scudi;
- oggetti meravigliosi, anelli e amuleti;
- verghe, bastoni e bacchette;
- strumenti;
- consumabili e munizioni;
- equipaggiamento generico;
- oggetti missione e altri oggetti.

### Equipaggiamento e profili difensivi

La definizione puo' contenere:

- tipo d'impugnatura: una mano, due mani o versatile;
- modalita' dei guanti: singolo o coppia;
- categoria armatura: leggera, media, pesante o scudo;
- formula della CA, base e bonus;
- regole di occupazione degli slot;
- gruppi di slot obbligatori o alternativi.

Quando il prodotto viene comprato, queste regole devono essere immediatamente disponibili al nuovo `CharacterItem` senza alcuna conversione manuale.

### Attacchi

Una `ItemDefinition` puo' avere piu' `ItemAttack`, ciascuno con:

- nome e tipo di attacco;
- requisito di impugnatura;
- caratteristica usata;
- bonus al tiro per colpire;
- dadi e tipo di danno;
- gittata normale e lunga;
- requisito di equipaggiamento;
- condizioni testuali e ordine.

La scheda prodotto del negozio deve poter visualizzare questi profili con la stessa rappresentazione usata dall'inventario PG. Il negozio non deve ricostruirli da testo libero.

### Modificatori meccanici

Gli `ItemModifier` possono agire su:

- CA;
- caratteristiche;
- velocita';
- iniziativa;
- PF massimi.

Possono essere valori fissi, formule, minimi imposti o override, applicati sempre oppure quando l'oggetto e' equipaggiato. Sono inoltre presenti le chiavi di stacking. Il passaggio negozio-PG deve conservare il riferimento alla definizione affinche' questi calcoli continuino a usare il motore esistente.

### Feature attive e passive

Ogni `ItemFeature` possiede:

- nome e descrizione;
- tipo `ACTIVE` o `PASSIVE`;
- condizione `ALWAYS` o `WHILE_EQUIPPED`;
- ordine di visualizzazione;
- per le feature attive: numero massimo di utilizzi e reset a volonta', incontro, riposo breve, riposo lungo, giornaliero o personalizzato;
- per le feature passive: elenco di `passiveEffects` strutturati gia' interpretati dal sistema delle skill/effetti passivi.

Il player deve poter consultare queste informazioni nella scheda del prodotto visibile, non soltanto dopo l'acquisto. Per gli oggetti segreti, nessuna di queste informazioni deve essere inclusa nel payload finche' l'oggetto non e' stato rivelato al PG.

### Requisiti ed effetti d'uso

Le definizioni supportano inoltre:

- requisiti minimi di caratteristica tramite `ItemAbilityRequirement`;
- effetti d'uso tramite `ItemUseEffect`;
- cura, danno, PF temporanei, condizioni, ripristino risorse ed effetti custom;
- bersaglio, dadi, valore fisso, tipo danno, tiro salvezza, CD, esito, durata e note.

Anche questi blocchi devono essere compresi nel dettaglio prodotto restituito dalle API negozio.

### Stato della copia posseduta

`CharacterItem` aggiunge alla definizione:

- quantita';
- override di nome e descrizione;
- note e dati della copia;
- stato equipaggiato e slot occupati;
- `CharacterItemFeatureState`, con utilizzi spesi e ultimo reset per ogni feature.

Lo stock del negozio deve poter conservare l'equivalente di nome/descrizione personalizzati, note, dati e stato delle feature. Questo e' necessario per oggetti unici, bacchette con cariche gia' consumate, artefatti o oggetti rivenduti da un PG.

Lo stato di equipaggiamento e gli slot non passano al negozio: quando il PG vende l'oggetto, esso viene disequipaggiato e le righe `CharacterItemEquip` vengono eliminate. Passano invece gli stati che appartengono intrinsecamente alla copia, come utilizzi spesi, ultimo reset, override e dati.

### Oggetti di catalogo e oggetti custom

La forma normale resta un `ShopItem` collegato a `ItemDefinition`. Se un PG vende un vecchio oggetto custom privo di definizione, il flusso deve:

1. preferibilmente creare o riusare una `ItemDefinition` coerente, seguendo il quick-create gia' esistente;
2. mantenere temporaneamente gli override e lo snapshot necessari;
3. evitare che l'oggetto perda descrizione o stato durante il trasferimento.

Il negozio non deve diventare un secondo catalogo parallelo.

### Visibilita' nella vetrina

`ItemDefinition.playerVisible` e `ShopItem.isSecret` rispondono a esigenze diverse:

- `playerVisible` e' la regola generale del catalogo/inventario;
- `isSecret` e la conoscenza negozio-PG determinano se il prodotto compare nella specifica vetrina.

Le API player devono applicare entrambe le regole in modo esplicito. La rivelazione DM rende visibile quel prodotto a quel PG, ma non deve accidentalmente pubblicare altri oggetti o dati DM. In fase di implementazione va centralizzata una funzione del tipo `canCharacterViewShopItem` per evitare regole divergenti tra API e realtime.

### Payload delle API negozio

Il dettaglio di un prodotto visibile al player deve includere una proiezione completa e sicura della `ItemDefinition`:

- dati base e descrizione effettiva, considerando gli override;
- slot, profili armatura e attacchi;
- modificatori comprensibili al player;
- feature attive/passive e relativi reset/utilizzi massimi;
- requisiti di caratteristica;
- effetti d'uso;
- quantita' disponibile.

Deve escludere:

- prezzo base finche' non esiste un'offerta;
- CD, note DM e dati amministrativi;
- stato interno di prodotti segreti non rivelati;
- identificativi o metadati non necessari che possano anticipare informazioni segrete.

Per non duplicare logica, il backend dovrebbe estrarre un serializer condiviso dalla lettura completa gia' usata da `readItemDefinition`, aggiungendo un serializer di istanza per `CharacterItem` e `ShopItem`.

### Trasferimento tra negozio e personaggio

Acquisto e vendita devono preservare:

- `itemDefinitionId`;
- override di nome e descrizione;
- note/dati trasferibili della copia;
- quantita';
- stati delle feature per gli oggetti non impilabili.

Non devono preservare:

- proprietario precedente;
- ordinamento nell'inventario precedente;
- stato equipaggiato e slot del PG venditore;
- note esclusivamente private del negozio.

Per gli stack comuni, lo stato per-copia non e' compatibile con una singola quantita' aggregata. Se un oggetto ha cariche, feature con utilizzi o dati individuali, deve essere trattato come istanza non impilabile anche se la definizione fosse stata configurata erroneamente come stackable. Questa validazione va applicata quando si inserisce lo stock e quando si conclude una transazione.

### `Shop`

- `id String @id`
- `name String`
- `externalKey String @unique`
- `description String @default("")`
- `ownerName String`
- `ownerDescription String @default("")`
- `city String`
- `discountDc Int?`
- `cp Int @default(0)`
- `sp Int @default(0)`
- `ep Int @default(0)`
- `gp Int @default(0)`
- `archivedAt DateTime?`
- `createdAt`, `updatedAt`

Indici: `city`, `name`, `archivedAt`.

### `ShopItem`

- `id String @id`
- `shopId String`
- `itemDefinitionId String?`
- override opzionali di nome e descrizione
- `quantity Int @default(1)`
- `priceCurrency CurrencyType`
- `priceAmount Int`
- `isSecret Boolean @default(false)`
- `discoveryDc Int?`
- `sortOrder Int @default(0)`
- `dmNotes String?`
- `instanceNotes String?` per note trasferibili con la copia
- `data String?` per lo stato strutturato della singola istanza non ancora normalizzato
- `createdAt`, `updatedAt`

Il prezzo e' monovaluta per contratto API. E' utile calcolarne il controvalore canonico in rame in memoria per confronti, senza perdere valuta e importo originali.

Per oggetti unici o non impilabili usare una riga per istanza. Per stock comuni impilabili usare `quantity`.

### `ShopItemFeatureState`

Equivalente di `CharacterItemFeatureState` quando la copia e' posseduta dal negozio:

- `id String @id`
- `shopItemId String`
- `itemFeatureId String`
- `usesSpent Int @default(0)`
- `lastResetAt DateTime?`
- `updatedAt DateTime`

Vincolo univoco `(shopItemId, itemFeatureId)`.

Questa tabella permette di vendere, ricomprare e rivendere una specifica copia senza rigenerarne cariche o utilizzi. In una futura rifondazione si potra' valutare un'entita' generica `ItemInstance` posseduta alternativamente da PG o negozio; per la V1, estendere in modo simmetrico il modello attuale e' meno invasivo e piu' compatibile con il codice esistente.

### `ShopCharacterProfile`

Memoria permanente della coppia negozio-PG:

- `id String @id`
- `shopId String`
- `characterId String`
- `visitCount Int @default(0)`
- `dmNotes String @default("")`
- `usualDiscountPercent Int?` opzionale come suggerimento futuro
- `lastVisitedAt DateTime?`
- `createdAt`, `updatedAt`

Vincolo univoco `(shopId, characterId)`.

### `ShopItemKnowledge`

Conoscenza permanente degli oggetti segreti:

- `id String @id`
- `shopId String`
- `shopItemId String`
- `characterId String`
- `revealedByUserId String?`
- `revealedAt DateTime`
- eventuale nota privata sull'esito esterno

Vincolo univoco `(shopItemId, characterId)`.

Se uno `ShopItem` viene eliminato, la conoscenza puo' essere eliminata in cascata; lo storico delle visite mantiene gli snapshot testuali necessari.

### `ShopVisit`

- `id String @id`
- `shopId String`
- `characterId String`
- `status ShopVisitStatus`
- `discountPercent Int @default(0)` con intervallo 0-100
- `openedByUserId String?`
- `closedByUserId String?`
- `closeReason String?`
- `dmNotes String @default("")`
- `openedAt DateTime`
- `closedAt DateTime?`
- `updatedAt DateTime`

Stati minimi: `ACTIVE`, `CLOSED_BY_DM`, `CLOSED_BY_PLAYER`, `INTERRUPTED`.

SQLite non offre un indice parziale esprimibile direttamente in Prisma per garantire una sola visita attiva. La regola va protetta da transazione server-side e, nella migrazione SQL, preferibilmente da indice univoco parziale su una costante per le righe `ACTIVE`.

### `ShopNegotiation`

Rappresenta la catena logica di proposte sul medesimo oggetto:

- `id String @id`
- `visitId String`
- `direction ShopTradeDirection`
- `shopItemId String?`
- `characterItemId String?`
- `quantity Int`
- `status ShopNegotiationStatus`
- snapshot iniziale dell'oggetto
- `createdAt`, `resolvedAt`, `updatedAt`

Direzioni: `SHOP_TO_CHARACTER`, `CHARACTER_TO_SHOP`.

Stati: `OPEN`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`.

### `ShopOffer`

Ogni rilancio e' una riga immutabile:

- `id String @id`
- `negotiationId String`
- `sequence Int`
- `proposedByUserId String`
- `sellerSide ShopTradeSide`
- `currency CurrencyType`
- `amount Int`
- `createdAt DateTime`

Vincolo univoco `(negotiationId, sequence)`. La proposta corrente e' quella con sequenza massima finche' la negoziazione e' `OPEN`.

Separare negoziazione e offerte rende leggibile il rimbalzo delle proposte senza aggiornare e perdere lo storico.

### Collegamenti ai ledger esistenti

Estendere `InventoryTransaction` con riferimenti opzionali al negozio, preferibilmente `fromShopId` e `toShopId`, mantenendo gli snapshot nelle righe `InventoryTransactionItem`.

Estendere `CurrencyTransaction` con `fromShopId` e `toShopId`. Aggiungere un riferimento opzionale alla negoziazione o memorizzarne l'identificativo in un campo dedicato, evitando di affidarsi alle note testuali.

Una compravendita puo' usare un `operationId` condiviso tra ledger oggetti e monete, necessario anche per l'annullamento tecnico atomico.

## Macchina delle controproposte

1. Il venditore apre una `ShopNegotiation` e inserisce la prima `ShopOffer`.
2. Il compratore puo' accettare, rifiutare o rilanciare.
3. Il rilancio aggiunge una nuova offerta alla stessa negoziazione e passa la decisione alla controparte.
4. Soltanto la controparte dell'ultima proposta puo' accettarla o rifiutarla.
5. L'accettazione ricontrolla autorizzazioni, visita, oggetto, quantita' e fondi.
6. L'accettazione esegue la compravendita e marca la negoziazione `ACCEPTED` nella stessa transazione.
7. Rifiuto e ritiro non muovono oggetti o monete.
8. La chiusura della visita porta tutte le negoziazioni `OPEN` a `EXPIRED`.

Per evitare doppie accettazioni, l'update deve essere condizionale su `status = OPEN`; se nessuna riga viene aggiornata, la richiesta e' gia' stata risolta.

## Transazione atomica di compravendita

L'accettazione deve avvenire interamente dentro `runInTransaction`:

1. rileggere visita e ultima offerta;
2. verificare che chi accetta sia il compratore;
3. verificare che visita e negoziazione siano ancora aperte;
4. verificare esistenza, proprieta' e quantita' dell'oggetto;
5. verificare fondi del compratore nella valuta richiesta, riusando le regole di resto/conversione gia' presenti dove applicabile;
6. disequipaggiare l'istanza PG venduta se necessario;
7. trasferire l'istanza o la quantita', inclusi override, dati e stati delle feature applicabili;
8. aggiornare i due saldi;
9. inserire ledger inventario e valuta con lo stesso `operationId`;
10. marcare la negoziazione accettata;
11. completare la transazione;
12. solo dopo il commit emettere gli aggiornamenti realtime.

Qualunque errore deve lasciare invariati tutti gli stati.

## API proposte

### Amministrazione DM

- `GET /api/dm/shops`
- `POST /api/dm/shops`
- `PATCH /api/dm/shops/:shopId`
- `DELETE /api/dm/shops/:shopId` come archiviazione
- CRUD `/api/dm/shops/:shopId/items`
- `GET /api/dm/shops/:shopId/characters/:slug/profile`
- `PATCH /api/dm/shops/:shopId/characters/:slug/profile`
- `GET /api/dm/shops/:shopId/visits`
- `POST /api/dm/shops/import` con `{ dryRun, payload }`
- `GET /api/dm/shops/import/catalog-index` per esportare gli slug riutilizzabili dal generatore

### Visita

- `POST /api/dm/shop-visits`
- `GET /api/shop-visits/active`
- `GET /api/shop-visits/:visitId`
- `PATCH /api/dm/shop-visits/:visitId`
- `POST /api/dm/shop-visits/:visitId/reveal/:shopItemId`
- `POST /api/shop-visits/:visitId/close`

Il server deve usare serializer separati:

- payload DM con prezzi, CD, segreti, saldo negozio e note;
- payload player senza dati privati e senza righe segrete non conosciute.

Nascondere campi soltanto nel frontend non e' sufficiente.

### Negoziazioni

- `POST /api/shop-visits/:visitId/negotiations`
- `POST /api/shop-negotiations/:id/counter-offers`
- `POST /api/shop-negotiations/:id/accept`
- `POST /api/shop-negotiations/:id/reject`
- `POST /api/shop-negotiations/:id/withdraw`

## Realtime

Eventi suggeriti:

- `shop-visit:opened`
- `shop-visit:state`
- `shop-visit:updated`
- `shop-negotiation:updated`
- `shop-visit:closed`

Destinatari:

- DM tramite stanza dedicata o connessioni del ruolo DM;
- player tramite `user:<ownerUserId>`;
- anche `char:<slug>` quando utile per aggiornare una scheda gia' aperta.

Il popup deve vivere in un listener/provider globale analogo alla rivelazione documenti. Socket.IO notifica i cambiamenti; il database e le API restano la fonte di verita'. Al refresh o alla riconnessione, `GET /api/shop-visits/active` ripristina la visita.

Dopo una compravendita vanno inoltre emessi gli aggiornamenti della scheda e dell'inventario gia' usati dall'app.

## Autorizzazioni

- Solo il DM gestisce negozi, stock, CD, rivelazioni, sconti e note.
- Solo il DM apre una visita.
- Il player accede esclusivamente alla visita del proprio personaggio.
- Solo il venditore puo' aprire una proposta iniziale.
- Solo la controparte dell'ultima proposta puo' accettare, rifiutare o rilanciare.
- Il player puo' chiudere solo la propria visita attiva.
- Il DM puo' chiudere la visita attiva e usare l'annullamento tecnico.
- Ogni controllo deve avvenire lato server, incluso il legame ownership user-personaggio.
- Le scritture player rispettano il blocco della sessione di gioco gia' esistente; va deciso in implementazione se la visita negozio debba essere utilizzabile solo a sessione aperta. La scelta coerente con le regole attuali e' mantenerne il blocco.

## Annullamento tecnico

L'annullamento esistente deve essere esteso, non duplicato. Prima di eseguirlo il server verifica:

- che l'operazione non sia gia' annullata;
- che il possessore attuale abbia ancora l'oggetto o la quantita' necessari;
- che il destinatario originario del denaro disponga dei fondi da restituire;
- che l'istanza possa tornare al proprietario precedente senza perdere stato;
- che tutte le scritture inverse possano completarsi atomicamente.

Se una condizione manca, l'annullamento tecnico viene rifiutato e si procede narrativamente con una nuova compravendita.

## Casi limite da coprire

- doppio click su accettazione;
- due richieste concorrenti sulla stessa offerta;
- stock modificato dal DM durante una trattativa;
- quantita' venduta o consumata altrove;
- fondi diventati insufficienti dopo la proposta;
- vendita parziale di uno stack;
- vendita di oggetto equipaggiato;
- oggetto unico con stato e cariche;
- visita chiusa mentre una conferma e' aperta;
- player offline al momento dell'apertura;
- refresh o riconnessione durante la visita;
- archiviazione del negozio con visita attiva;
- modifica/eliminazione di uno stock conosciuto dal PG;
- annullamento tecnico dopo ulteriori movimenti dell'oggetto o del denaro.

## Piano di sviluppo incrementale

### Fase 1: schema e dominio

- aggiungere enum, tabelle, relazioni e indici;
- preparare migrazione SQL additiva;
- implementare serializer DM/player e helper di dominio;
- verificare `prisma validate` e schema su una copia del DB locale.

### Fase 2: amministrazione negozi

- CRUD negozi e stock;
- pagina DM raggruppata per citta';
- saldo, segreti, CD, prezzi e profili PG;
- import JSON con schema versionato, anteprima transazionale e indice catalogo esportabile;
- testare prima di committare.

### Fase 3: visite sincronizzate

- apertura e chiusura;
- unicita' della visita attiva;
- popup globale player;
- contatore visite, note, sconto e rivelazioni permanenti;
- recupero dopo refresh.

### Fase 4: negoziazioni

- proposta iniziale e popup di conferma;
- rilanci immutabili;
- accettazione, rifiuto, ritiro e scadenza;
- aggiornamenti realtime delle due viste.

### Fase 5: compravendita atomica

- stock e istanze;
- saldi e conversioni;
- ledger inventario e valuta;
- gestione equipaggiamento;
- notifiche alla scheda.

### Fase 6: annullamento tecnico e robustezza

- estendere undo esistente ai negozi;
- test autorizzazioni e concorrenza;
- test casi limite;
- rifinitura responsive e messaggi di errore.

## Strategia DB e deploy

Il DB Railway e' la fonte canonica; il DB locale e' solo dev/snapshot. Le modifiche devono essere additive e compatibili.

Prima della produzione:

1. testare la migrazione su una copia locale;
2. eseguire `npm run backup:prod-db`;
3. applicare la procedura schema non distruttiva concordata;
4. deployare codice compatibile;
5. verificare health, login, CRUD negozi, visita, transazione e persistenza;
6. conservare un piano di rollback manuale.

Non usare `prisma db push` sulla produzione senza comando esplicito, backup appena creato e verifica della migrazione.

## Primo task consigliato

Avviare la Fase 1 in un blocco circoscritto:

1. tradurre il modello proposto in Prisma;
2. verificare le relazioni necessarie con `User`, `Character`, `ItemDefinition`, `InventoryTransaction` e `CurrencyTransaction`;
3. preparare la migrazione additiva senza applicarla alla produzione;
4. implementare soltanto helper e API di lettura/CRUD di base;
5. fermarsi per test e conferma prima del commit, secondo il flusso operativo del progetto.
