# Censimento di creazione e progressione PHB

> Aggiornamento 2026-10-02: preview autorevole, diario delle decisioni e concessioni,
> background personalizzato e varianti, risorse iniziali integrate. Database locale
> allineato; nessuna modifica Railway. [Checkpoint corrente](implementation-step-two.md).
> Le verifiche datate nei paragrafi precedenti descrivono incrementi storici.

Checkpoint del **2026-10-01**. Fonte: [Manuale del Giocatore 5.0](../Manuale_del_Giocatore_5.0.md),
edizione 2014 in italiano. Questa raccolta estende l'[audit iniziale](../character-creation-progression-model-audit.md)
all'intero perimetro richiesto. Ogni inventario distingue acquisizioni,
scelte, sostituzioni, usi e livello totale/di classe; non certifica
l'automazione della scheda o la correttezza delle righe OCR ambigue.

## Copertura documentale

| Famiglia | Copertura | Documento |
| --- | --- | --- |
| Regole comuni | Point buy, identità, PF/ASI/talenti, duplicati, ingresso multiclasse e cumulo | [Origini e talenti](origins-and-feats.md) |
| Razze | Nove base + Umano Alternativo; nove sottorazze; dieci discendenze Dragonide; eventi razziali sul livello totale | [Origini e talenti](origins-and-feats.md) |
| Background | Tredici base + cinque varianti; alternative di privilegi/dotazione e personalizzazione | [Origini e talenti](origins-and-feats.md) |
| Talenti | Tutte le 42 voci, requisiti, scelte annidate, condizioni e risorse | [Origini e talenti](origins-and-feats.md) |
| Marziali e ibride | Barbaro, Guerriero, Ladro, Monaco, Paladino, Ranger; 16 sottoclassi e livelli 1–20 | [Classi marziali](classes-martial.md) |
| Incantatrici | Bardo, Chierico, Druido, Mago, Stregone, Warlock; 24 sottoclassi e livelli 1–20 | [Classi incantatrici](classes-casters.md) |
| Varianti interne magiche | Liste di sette domini, otto terre, tre patroni, otto metamagie, tre Doni e 32 suppliche | [Classi incantatrici](classes-casters.md) |
| Modello comune | Definizioni, eventi, scelte, concessioni, risorse, API/persistenza e compatibilità | [Contratto proposto](decision-model.md) |
| Verifica sorgente | Sei pagine originali: Ki, soglie privilegi e omissione Mistificatore Arcano | [Confronto PDF](source-verification.md) |

Le descrizioni integrali e le liste complete di equipaggiamento rimangono
nella sorgente; gli inventari registrano le condizioni necessarie alla
configurazione e i riferimenti per consultarle. I conteggi del catalogo
attuale non sono un criterio sufficiente di correttezza. Non esiste ancora
una definizione eseguibile versionata per ogni voce di questa raccolta.

## Cosa cambia rispetto al modello attuale

Il modello per eventi è necessario: il solo catalogo di livello 1 con
rami per classe non rappresenta preparazioni dopo riposo, copie dei libri,
sostituzioni, scelte a livelli ripetuti, benefici sul possessore di un
oggetto o risorse con limiti sul bersaglio. Si possono riusare gli strumenti
degli effetti delle skill per le proiezioni, mantenendo i privilegi nelle
card di origine collassabili richieste dall'utente.

Patrono Warlock, Dono del Patto e Supplica hanno gruppi e trigger distinti.
Una lista ampliata autorizza una scelta; non concede tutte le magie.
Le magie speciali restano nella sezione esistente, raggruppate per livello,
con modalità di lancio e risorse della propria fonte.

La campagna mantiene PF pieni e riposi personalizzati già decisi; il PHB
censito è la base da cui registrare queste differenze come regole esplicite.

## Difetti e incertezze da chiudere prima delle definizioni eseguibili

1. **Catalogo magico:** lacune/fuori lista già nei livelli 0–1 e alias/flag
   errati nel legacy. Usare il confronto ripetibile e controllare le
   descrizioni, non importare automaticamente il risultato come correzione.
2. **Scelte iniziali:** verificare lingue da privilegi (Druidico, Draconico
   dello Stregone), strumento posseduto separato dagli strumenti competenti
   del Bardo e alternative dei background, comprese quelle non obbligatorie.
3. **Progressione:** servono concessioni e decisioni guidate per Doni,
   suppliche, maestrie, metamagie, manovre, nemici/terreni, magie e talenti,
   con sostituzioni solo dove autorizzate.
4. **Fonte OCR:** gli inventari delle classi registrano soglie/testi
   contraddittori o illeggibili. La tabella del livello non risolve da sola
   il testo di una capacità. Confrontare il frammento con la pagina originale
   prima di attivare quella regola; nessuna correzione presunta del manuale.
5. **Compatibilità:** non dedurre una scelta dal semplice nome di un tratto
   o ricreare decisioni mancanti dei PG esistenti. Preservare ID, competenze
   manuali, autorizzazioni e house rule.

## Primo incremento eseguibile

Catalogo di 361 magie, liste iniziali riallineate, motore puro e adattatore
iniziale disponibili. P1 245/245, build e TypeScript superati. Perimetro,
warning OCR e prossime attività: [checkpoint eseguibile](implementation-step-one.md).
Le note seguenti descrivono la fase documentale precedente.

## Verifiche della fase documentale

Rieseguiti in sola lettura: `audit-phb-class-progressions.mjs --summary`
(12 tabelle, 20 livelli ciascuna) e `audit-phb-spell-lists.mjs --summary`
(differenze confermate). Questi controlli strutturali non validano tutte le
interpretazioni semantiche. L'audit non ha cambiato runtime, schema o DB.
Build/P1/TypeScript non sono stati rieseguiti per questo incremento documentale.

Controllati inoltre i dodici calendari degli inventari (20 livelli ciascuno),
le 42 righe dei talenti, i link locali e il whitespace. Review documentale
indipendente: corretto l'unico finding sul Pirata, per cui Pessima Fama è
facoltativa. La verifica visiva di sei pagine ha risolto alcune incertezze
OCR e recuperato la tabella Ki; l'omissione MA3 è invece presente nel PDF.

Il prossimo incremento parte dalle ambiguità/cataloghi e dal resolver puro
descritto nel contratto, poi adattatore della creazione, persistenza dedicata
e progressione. La copertura guidata completa richiederà collaudo dei casi
elencati negli inventari e nel contratto, oltre alle verifiche del progetto.
