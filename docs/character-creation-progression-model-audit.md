# Audit del modello di creazione e progressione (PHB 2014)

> Aggiornamento 2026-10-02: preview autorevole, diario delle decisioni e concessioni,
> background personalizzato e varianti, risorse iniziali integrate. Database locale
> allineato; nessuna modifica Railway. [Checkpoint corrente](rules-inventory/implementation-step-two.md).
> Le verifiche datate nei paragrafi precedenti descrivono incrementi storici.

Stato aggiornato al **2026-10-01**: analisi del contratto, non dichiarazione di copertura completa del manuale. Fonte di riferimento: `docs/Manuale_del_Giocatore_5.0.md`. Le regole personalizzate della campagna vanno versionate separatamente. Implementazione attuale, feedback e limiti: [creazione di livello 1](character-creation-level-one.md).

Il mandato riguarda creazione e progressione di **tutte** le razze/classi e varianti del perimetro, prima di aggiungere altre scelte puntuali. Il modello per eventi descritto qui è una raccomandazione tecnica; schema, API e motore generale non sono ancora implementati.

## Primo incremento eseguibile (2026-10-01)

Catalogo di 361 magie, motore puro e adattatore della creazione disponibili:
[stato eseguibile](rules-inventory/implementation-step-one.md). Le differenze
magiche riportate nell'audit sotto precedono il riallineamento: le liste
iniziali 0–1 ora coincidono con il manuale. Schema/API delle nuove decisioni,
sostituzioni, preparazione e progressione completa restano aperti.

## Avanzamento del censimento (2026-10-01)

L'inventario semantico per famiglie è ora raccolto in [rules-inventory](rules-inventory/README.md):
origini e 42 talenti, sei classi marziali/ibride e sei incantatrici, con
40 sottoclassi, eventi di livello 1–20 e scelte interne. Il
[contratto di decisioni](rules-inventory/decision-model.md) concretizza pool,
dipendenze, concessioni, risorse, provenienza e persistenza proposta.
Questo censimento espone anche ambiguità OCR e lacune del runtime; la copertura
documentale non certifica né la correttezza delle righe ambigue né un motore
guidato completo. La prossima fase verifica quelle ambiguità e riallinea
i cataloghi prima di introdurre il resolver comune.

## Decisione tecnica

Conviene sostituire il modello di scelte legato esclusivamente al livello 1 con un **motore di decisioni guidate per eventi**. La creazione è l'evento iniziale; ogni avanzamento di classe è un altro evento. Razza, sottorazza, classe, sottoclasse, background, talento e privilegio sono fonti di regole. Ogni fonte può concedere capacità fisse, aprire scelte, ampliare insiemi di opzioni e attivare effetti a un livello determinato.

| Strada | Vantaggio | Limite | Esito |
| --- | --- | --- | --- |
| Aggiungere casi a `character-creation-rules.mjs` | Poco lavoro per una singola correzione | Con ogni livello e fonte cresce la duplicazione tra opzioni, validazione, proiezione e pulizia client | Non adatta al percorso completo |
| Un wizard distinto per ciascuna classe | Interfaccia specifica facile da disegnare | Le regole condivise (multiclasse, talenti, magie, competenze duplicate) divergerebbero | Non adatta |
| Definizioni di regola + decisioni per evento | Un solo contratto verificabile per creazione e level up; dipendenze e prerequisiti espliciti | Richiede un inventario completo e un adattatore per gli snapshot esistenti | Raccomandata |

Non serve riscrivere subito le tabelle di progressione già presenti. `CharacterClass` conserva i livelli per classe e `CharacterLevelHistory` offre già uno storico con snapshot e versione delle regole (`prisma/schema.prisma:454-543`). Il limite attuale è il contenuto delle decisioni: `CharacterCreation` conserva un solo insieme di `selections` e uno snapshot risolto (`prisma/schema.prisma:383-393`), mentre l'anteprima di avanzamento richiede la sottoclasse ma non enumera o valida le altre scelte di quel livello (`shared/character-class-rules.mjs:501-588`).

Il catalogo attuale (`shared/character-creation-rules.mjs`) combina dati, opzioni, eccezioni, validazione e proiezione finale. Le dipendenze sono codificate per ID specifici: patrono Warlock → incantesimi; dominio Chierico → competenze; origine Stregone → antenato; nemico Ranger → razze/lingua; libro Mago → preparati. Il client replica alcune dipendenze quando cancella scelte (`src/pages/GuidedCharacter.tsx:176-196`). Questo rende fragile aggiungere livelli e varianti, perché ogni nuova fonte richiede rami paralleli nel server e nel client.

Il perimetro già esposto dal codice è 10 razze, 9 sottorazze, 12 classi, 40 sottoclassi, 18 background e 42 talenti. Questi sono conteggi del catalogo, **non** una prova che ogni variante e ogni privilegio sia stato verificato contro il manuale.

## Informazioni da estrarre dal manuale

Per ogni regola va registrato un ID stabile, il nome italiano, la fonte precisa (capitolo, pagina e riga del Markdown), il livello che la attiva, il tipo di livello (`personaggio` o `classe`), i prerequisiti, i benefici fissi, le scelte obbligatorie/facoltative, il momento in cui può essere sostituita, la frequenza d'uso e gli effetti applicabili alla scheda. Le descrizioni consultabili sono contenuto della stessa definizione, non testo di ripiego.

| Area | Fonte nel manuale | Varianti che il modello deve esprimere |
| --- | --- | --- |
| Creazione generale | righe 340-620; point buy 456-471 | 27 punti, bonus razziali successivi, dotazione o acquisto, progressione del livello totale |
| Razze e sottorazze | righe 621-1492 | concessioni fisse, scelta di lingua/strumento, discendenza, talento, magie razziali che si sbloccano a livelli del personaggio successivi (Tiefling 1463-1467) |
| Dodici classi | righe 1493-5797 | privilegi e scelte ai livelli di classe 1-20, sottoclassi, risorse, sostituzioni, incantesimi noti/preparati/libro, capacità con usi e riposi diversi |
| Background e varianti | righe 5798-7070 | competenze, lingue, strumenti, privilegi, dotazioni, doppioni; personalizzazione del background consentita alle righe 6026-6040 |
| Multiclasse e talenti | righe 7930-8419 | prerequisiti, competenze ridotte, ASI o talento, livelli per classe contro livello totale, magie e slot separati, privilegi non cumulativi |
| Incantesimi | liste 9906-11016, descrizioni da 11017 | accesso alla lista, incantesimo conosciuto, preparato, sempre preparato, libro, rituale, lancio a volontà e senza slot, sostituzione; identità stabile distinta dal nome visualizzato |

`node scripts/audit-phb-class-progressions.mjs --summary` ha individuato tutte le dodici tabelle di progressione: **12/12 con 20 livelli e nessun livello mancante**. Il rapporto completo riporta testo del privilegio e riga sorgente per ciascun livello. L'estrazione della tabella verifica la copertura strutturale, non ancora le condizioni contenute nella prosa di ogni privilegio.

| Classe | Riga della tabella | Livello della scelta di sottoclasse |
| --- | ---: | ---: |
| Barbaro | 1552 | 3 |
| Bardo | 1849 | 3 |
| Chierico | 2040 | 1 |
| Druido | 2550 | 2 |
| Guerriero | 2903 | 3 |
| Ladro | 3240 | 3 |
| Mago | 3525 | 2 |
| Monaco | 3974 | 3 |
| Paladino | 4323 | 3 |
| Ranger | 4735 | 3 |
| Stregone | 5015 | 1 |
| Warlock | 5352 | 1 |

Queste aree devono essere censite per **tutte** le razze/sottorazze, classi/sottoclassi, background/varianti e talenti prima di dichiarare completo il percorso. Una tabella di progressione con il solo nome del privilegio non basta: per ogni riga servono le decisioni interne e i loro prerequisiti.

## Forme di scelta da supportare

1. **Concessione automatica**: per esempio competenza o privilegio che arriva al livello richiesto.
2. **Una o più opzioni da elenco**, anche con cardinalità dipendente da livello o caratteristica.
3. **Scelta annidata**: sottoclasse che aggiunge capacità/scelte; talento o Dono del Patto che apre altre scelte.
4. **Lista ampliata**: il patrono aggiunge incantesimi eleggibili senza concederli automaticamente (`manuale:5525-5537`, `5570-5582`, `5615-5627`).
5. **Concessione magica separata dalla lista**: trucchetto razziale, incantesimo di dominio sempre preparato, rituale nel libro, lancio a volontà tramite supplica.
6. **Sostituzione**: un Warlock può sostituire un incantesimo conosciuto e una supplica a ogni nuovo livello Warlock (`manuale:5441-5458`); non è una nuova concessione aggiuntiva.
7. **Preparazione riconfigurabile dopo il riposo**: stato corrente della scheda, distinto dalle scelte permanenti fatte al level up.
8. **Alternativa con costo/esclusione**: ASI o talento, equipaggiamento iniziale o acquisto, competenza duplicata sostituita da altra dello stesso tipo (`manuale:6013-6039`, `8070-8079`).
9. **Scelta condizionata e dinamica**: prerequisiti di caratteristica, competenza, incantesimo noto, Dono, livello di classe, o livello totale.
10. **Scelta narrativa o personalizzata**: tratti personali e background personalizzato, con approvazione/regole di campagna dove il manuale la richiede.

Un record di definizione proposto:

```json
{
  "id": "warlock.invocation.fiendish-vigor",
  "source": { "book": "PHB-2014-it", "page": 119, "line": 5759 },
  "trigger": { "classKey": "warlock", "minClassLevel": 2 },
  "choiceGroup": "warlock.invocations",
  "prerequisites": [],
  "grants": [{ "kind": "spellCasting", "spellId": "false-life", "spellLevel": 1, "target": "self", "frequency": "atWill", "slotCost": 0, "ignoreMaterialComponents": true }]
}
```

Le decisioni del PG dovrebbero registrare `choiceId`, opzioni selezionate, livello totale e livello della classe al momento della scelta, regola/versione e operazione (`acquire`, `replace`, `prepare`). Il server calcola le concessioni da regole e decisioni; la scheda visualizza quelle concessioni e conserva separatamente utilizzi, preparazioni correnti ed eventuali modifiche manuali. Il nuovo registro di decisioni e gli stati riconfigurabili richiedono tabelle/campi dedicati e API esplicite, da progettare prima dell'implementazione, secondo le istruzioni correnti del progetto. Gli snapshot di `CharacterCreation` e `CharacterLevelHistory` restano provenienza e compatibilità; `Character.data` resta legacy. La transizione non deve inventare decisioni mancanti o alterare gli identificativi persistiti.

## Caso Warlock che ha evidenziato il limite

- Il patrono si sceglie al livello Warlock 1; concede un privilegio e amplia gli incantesimi eleggibili. Il Dono del Patto (Catena, Lama o Tomo) è una scelta distinta al livello Warlock 3 (`manuale:5420`, `5460-5490`).
- Le Suppliche Occulte iniziano al livello Warlock 2, con prerequisiti riferiti al livello **di classe** e possibilità di sostituzione ai livelli successivi (`manuale:5454-5458`, `5647-5649`).
- **Vigore Immondo** è una supplica disponibile a un Warlock che la sceglie dal livello 2, indipendentemente dal patrono. Permette di lanciare **Vita Falsata** su sé stesso a volontà come incantesimo **di 1° livello**, senza slot né componenti materiali (`manuale:5759-5761`). Vita Falsata non è un trucchetto (`manuale:14114-14124`) e non è nella lista base degli incantesimi Warlock (`manuale:10911-11016`).
- Progressione Warlock: patrono 1; suppliche 2; Dono 3; ASI 4/8/12/16/19; privilegi del patrono 6/10/14; Arcanum 11/13/15/17; Maestro dell'Occulto 20. La tabella completa con trucchetti, incantesimi, slot e suppliche è alle righe 5352-5373.
- Le liste ampliate dei tre patroni coprono gli incantesimi di livello 1-5 (`manuale:5531-5537`, `5574-5582`, `5619-5627`), ma il codice contiene soltanto il livello 1. Catena/Tomo e quasi tutte le Suppliche non hanno ancora scelte e concessioni strutturate.

## Catalogo degli incantesimi: verifica ripetibile

`node scripts/audit-phb-spell-lists.mjs` confronta le liste del manuale con `shared/character-creation-spell-options.json` (livelli 0-1); `--legacy --all-levels` confronta il catalogo legacy a tutti i livelli. `--class warlock` limita il rapporto. Le differenze sono un elenco di verifica: omonimie/alias e refusi OCR vanno controllati prima di migrare i dati.

| Classe | Mancanti 0-1 | Fuori lista 0-1 |
| --- | ---: | ---: |
| Bardo | 2 | 0 |
| Chierico | 0 | 0 |
| Druido | 2 | 0 |
| Mago | 5 | 1 |
| Stregone | 5 | 0 |
| Warlock | 5 | 1 |

Paladino e Ranger iniziano a lanciare incantesimi al livello di classe 2: il catalogo *di creazione* non offre loro scelte magiche al livello 1, coerentemente con la progressione, ma le liste complete servono per il level up. Nel Warlock mancano in 0-1 Amicizia, Interdizione alle Lame, Armatura di Agathys, Braccia di Hadar e Dardo Stregato; Dardo Incantato è fuori lista (`manuale:10911-10937`). Nel catalogo legacy completo mancano inoltre Corona di Follia, Fame di Hadar, Blocca Mostri, Portale Arcano e Previsione, dopo normalizzazione degli alias verificati. Il flag `ritual` di Sortilegio è errato rispetto alla descrizione del manuale. Il catalogo legacy è un input storico, non una fonte normativa.

## Criteri per iniziare l'implementazione del nuovo modello

1. Inventario per ogni razza, sottorazza, classe, sottoclasse, background, variante e talento, con ID, pagina, trigger, scelte, prerequisiti, benefici e stato di implementazione. Le famiglie sono ora documentate in rules-inventory; restano da chiudere le ambiguità OCR segnalate e da trasformare le voci in definizioni versionate con ID stabili.
2. Separazione esplicita tra livello totale, livello della classe, livello dell'incantesimo e livello dello slot. Test su mono e multiclasse.
3. Catalogo magico completo con ID stabili, alias italiani, liste di appartenenza e ruoli di concessione; correzione delle differenze prima di abilitare le opzioni guidate.
4. Contratto condiviso per risolvere scelte, validarle e proiettarle nella scheda. Client e server consumano la stessa definizione delle dipendenze, evitando rami specifici duplicati.
5. Transizione compatibile: interpretare gli snapshot di creazione già salvati e le schede manuali senza inventare retroattivamente scelte mancanti.

## Stato delle verifiche documentali

Gli script di audit sono stati rieseguiti in sola lettura il 2026-10-01: confermati 12/12 tabelle da 20 livelli e le differenze di liste 0-1 riportate sopra. Il rapporto delle liste comprende anche Paladino e Ranger: i loro incantesimi di livello 1 appartengono al futuro percorso di classe dal livello 2, non a scelte mancanti nel wizard di creazione del personaggio di livello 1. L'inventario per famiglie è stato aggiunto in questa fase; ambiguità della sorgente e lacune applicative hanno uno stato distinto dalla copertura.
