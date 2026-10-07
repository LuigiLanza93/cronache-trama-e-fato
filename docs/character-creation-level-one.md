# Creazione guidata di livello 1: stato e prosecuzione

> Aggiornamento 2026-10-02: preview autorevole, diario delle decisioni e concessioni,
> background personalizzato e varianti, risorse iniziali integrate. Database locale
> allineato; nessuna modifica Railway. [Checkpoint corrente](rules-inventory/implementation-step-two.md).
> Le verifiche datate nei paragrafi precedenti descrivono incrementi storici.

Checkpoint della chat aggiornato al **2026-10-01**. La creazione guidata è implementata nella copia di sviluppo su `dev`, con modifiche applicative e migrazioni non committate. Il modello generale per creazione e progressione è ancora una proposta da completare dopo il censimento del manuale.

## Obiettivo concordato

Consentire la creazione completa di un PG di livello 1 e i successivi level up guidati per tutte le razze, sottorazze, classi e sottoclassi del Manuale del Giocatore 5.0, includendo background, varianti e talenti. Prima di aggiungere altre scelte puntuali va verificato l'intero perimetro delle regole e valutato un modello comune, configurabile e compatibile con le schede esistenti.

Il Warlock è stato il caso che ha evidenziato i limiti delle scelte codificate per singola classe; l'audit richiesto riguarda l'intero manuale. Il riferimento tecnico è [l'audit del modello](character-creation-progression-model-audit.md). Le house rule già concordate della campagna, inclusi i PF pieni al level up, restano esplicite e separate dalle regole del manuale.

## Primo incremento del contratto comune

Disponibili catalogo di 361 magie dal Markdown, dettagli nel wizard e nella
scheda, validator condiviso e primi eventi dichiarativi. Corrette lingue
automatiche, expertise del Ladro e scelta indipendente dello strumento del
Bardo. Retry storici conservati con controllo del proprietario attuale.
P1 **245/245**, build, TypeScript app/configurazione e sintassi superati;
review indipendente senza finding materiali residui. Browser e produzione
non verificati. [Perimetro e limiti aggiornati](rules-inventory/implementation-step-one.md).

Le note sui cataloghi e sulle verifiche precedenti qui sotto sono storiche:
le liste iniziali 0–1 ora coincidono con il manuale; due metadati OCR restano
esplicitamente incerti. Persistenza delle nuove decisioni e level up completo
restano aperti.

## Implementazione disponibile

- Wizard DM per i PG di livello 1; i PNG conservano il percorso precedente. Il PG creato è inizialmente non assegnato.
- Razza/sottorazza, classe, background, scelte iniziali e point buy da 27 punti con valori base 8-15 e bonus successivi separati.
- Abilità, strumenti, lingue, expertise, talenti dell'Umano variante e scelte dipendenti previste dal catalogo corrente. Le concessioni automatiche non sono richieste una seconda volta.
- Scelta alternativa per competenze duplicate, con indicazione delle due fonti; per esempio Ladro + Criminale concedono entrambi arnesi da scasso. La scelta compare solo quando c'è il conflitto.
- Equipaggiamento iniziale nell'inventario relazionale, valuta, PF, Dadi Vita, pool di risorse, classe e sottoclasse iniziali; salvataggio transazionale con richiesta idempotente.
- Campi narrativi liberi per due tratti della personalità, ideale, legame e difetto; la loro validazione è mostrata nel relativo passo.
- Card **Privilegi di origine**, inizialmente chiusa, con gruppi e voci espandibili per Razza, Classe e Background e descrizioni estese. I privilegi non riempiono Skills; competenze e bonus supportati entrano nelle strutture native e nel motore degli effetti anche con la card chiusa.
- Trucchetti e incantesimi scelti nel wizard hanno dettagli consultabili e compaiono nella sezione magica già presente nella scheda, raggruppati per livello insieme alle voci manuali. Inclusi i trucchetti razziali fissi e le concessioni iniziali del dominio censite.
- Patroni Warlock con etichette italiane e ampliamento delle opzioni magiche di livello 1; cambiare patrono azzera la precedente scelta degli incantesimi. L'ampliamento non concede automaticamente incantesimi aggiuntivi.
- Lama del Patto visibile e utilizzabile soltanto con Patto della Lama e almeno tre livelli Warlock, anche nei multiclasse. La supplica legacy Lama Assetata è riconosciuta come prova del patto; l'arma virtuale salvata è soppressa per i PG non idonei.

Il catalogo esposto contiene 10 razze (incluso Umano variante), 9 sottorazze, 12 classi, 40 sottoclassi, 18 background e 42 talenti. Il conteggio descrive il catalogo, non certifica tutte le regole o combinazioni.

## Persistenza e compatibilità

`CharacterCreation` conserva selezioni, snapshot risolto, versione delle regole e identificativo/firma della richiesta. Narrazione, inventario, valuta e progressione usano le rispettive strutture dedicate. I proiettori server espongono privilegi e magie dello snapshot anche per i PG guidati già creati; le voci manuali sono preservate. Non vengono inventate scelte originarie per le schede legacy.

Migrazioni della feature:

- `prisma/migrations/20260925_character_creation_level_one/`;
- `prisma/migrations/20260925_character_creation_request_id/`.

Il dry-run del **2026-10-01** sul DB locale ha restituito `before: true`, `after: true`, `requestIdReady: true`. Questa verifica attesta la presenza dello schema richiesto dalla creazione, non lo stato dello schema o dei dati Railway.

## Feedback e verifiche

L'utente ha creato un Ladro e ha giudicato corretta la costruzione della scheda; ha poi dato riscontro positivo sul flusso di creazione e sulla visualizzazione degli incantesimi per livello. I feedback hanno portato alle correzioni su narrazione, privilegi, doppioni, dettagli magici, persistenza delle magie e Warlock. Non equivalgono al completamento dell'intero [piano di collaudo](level-one-creation-manual-test-plan.md); le ultime correzioni e le combinazioni non provate restano da collaudare.

Ultimo checkpoint automatico applicativo registrato nella chat, **2026-09-28**: suite P1 **224/224**, TypeScript app, build, sintassi e diff check superati; revisione qualità delle correzioni Warlock senza problemi materiali residui. Queste verifiche non sono state rieseguite per l'aggiornamento documentale del 2026-10-01. Nessun commit, push o rilascio in produzione è stato eseguito in questa attività.

## Limiti aperti

- L'inventario semantico per famiglie è raccolto in [rules-inventory](rules-inventory/README.md), incluse scelte e progressione 1–20. Restano ambiguità OCR da risolvere e definizioni versionate da implementare; non equivale alla copertura completa del runtime.
- Il catalogo magico corrente ha lacune e voci fuori lista già ai livelli 0-1; il riallineamento deve precedere l'automazione completa. Il JSON legacy è input storico, non fonte normativa.
- Gli incantesimi preparati proiettati dallo snapshot sono quelli scelti alla creazione; non rappresentano ancora i cambi dopo riposo lungo.
- Alcuni effetti condizionali e privilegi complessi hanno descrizioni/scelte registrate ma non automazione completa. L'equipaggiamento iniziale non viene equipaggiato automaticamente.
- Il level up già disponibile gestisce livelli, sottoclassi, PF/Dadi Vita e risorse supportate; non completa ancora tutte le scelte di magie, talenti, privilegi e sostituzioni.
- Doni del Patto e Suppliche Occulte non hanno ancora un percorso di scelta guidato completo. **Vigore Immondo** è una supplica selezionabile dal livello Warlock 2, indipendente dal patrono; concede Vita Falsata di 1° livello a volontà su sé stessi, senza slot o componenti materiali. Non va aggiunta ai trucchetti o ai privilegi iniziali dell'Immondo.

## Prossimo lavoro

1. Chiudere le ambiguità OCR del censimento e riallineare i cataloghi, assegnando ID stabili e provenienza alle definizioni.
2. Tradurre il [contratto comune](rules-inventory/decision-model.md) in definizioni e resolver condiviso, con varianti consentite e dipendenze fra scelte.
3. Progettare persistenza dedicata e API esplicite per le nuove decisioni e gli stati riconfigurabili, riusando le strutture e lo storico esistenti. `Character.data` resta legacy; gli snapshot conservano compatibilità e provenienza.
4. Riallineare i cataloghi e implementare risoluzione, validazione server, anteprima, salvataggio e proiezioni della scheda sul contratto verificato.
5. Collaudare creazione e progressione mono/multiclasse con copertura delle forme di scelta, poi finalizzare il perimetro concordato dopo conferma utente.

## Strumenti e file

```powershell
npm.cmd run creation:level-one:dry-run
node scripts/audit-phb-class-progressions.mjs --summary
node scripts/audit-phb-spell-lists.mjs --summary
node scripts/audit-phb-spell-lists.mjs --legacy --all-levels --class warlock
```

Gli script di audit sono di sola lettura. Il rapporto delle liste magiche include Paladino e Ranger: l'assenza di scelte nel catalogo di creazione al livello del personaggio 1 è prevista, perché iniziano a lanciare incantesimi al livello di classe 2. Le differenze nominali/alias e gli artefatti OCR vanno verificati prima di usare i rapporti per correggere dati.

- Regole e scelte attuali: `shared/character-creation-rules.mjs`.
- Proiezioni privilegio/magia: `shared/character-creation-capabilities.mjs`, `shared/character-creation-feature-descriptions.mjs`, `shared/character-creation-spells.mjs`.
- Wizard e scheda: `src/pages/GuidedCharacter.tsx`, `src/pages/CharacterSheet.tsx`, `src/components/characterSheet/creation-privileges.tsx`.
- API e persistenza: `server.js`, `src/lib/auth.ts`, `prisma/schema.prisma`.
- Roadmap: [prodotto](product-roadmap.md), [progressione e M8](multiclass-roadmap.md).
