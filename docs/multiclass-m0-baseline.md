# Gate 1.8A - M0: decisioni e baseline

Stato: **M0 completato; decisioni D0 confermate il 2026-08-13**.
Data: 2026-08-13.
Perimetro: dati locali di sviluppo e contratti applicativi; Railway non interrogato e non modificato.

## Esito

La baseline corrente consente di progettare M2 e M3 senza inventare dati:

- i 4 PG attivi locali sono monoclasse e hanno classe/livello coerenti tra colonne SQLite e `data.basicInfo`; lo stesso vale per il PG e il PNG archiviati;
- le classi reali sono `Guerriero`, `Ladro`, `Bardo` e `Warlock`, tutte riconducibili senza ambiguita a chiavi stabili;
- Dadi Vita e stato dei riposi sono aggregati e non possono rappresentare taglie diverse;
- `combatStats.spellSlots` contiene slot da incantatore, Pact Magic e risorse di classe del Guerriero: la forma e uniforme, la semantica no;
- feature e incantesimi storici non hanno provenienza strutturata affidabile e non devono essere interpretati dal titolo;
- il backfill futuro puo creare una sola `CharacterClass` per i quattro PG, ma deve conservare PF, slot e risorse come stato effettivo legacy finche i nuovi pool non sono risolti esplicitamente.

M0 non autorizza una migrazione. Lo schema e i dati Railway restano invariati.

## Decision record D0 confermato

Principio di precedenza: le regole gia implementate nella campagna restano invariate e vengono formalizzate come house rule. SRD 5.1/2014 colma cio che non e ancora definito. Se una regola esistente confligge con SRD o con il nuovo modello, il conflitto viene reso esplicito e risolto separatamente senza sostituzioni silenziose.

| Tema | Decisione proposta |
| --- | --- |
| Ruleset | `srd-5.1-2014` come fallback per i vuoti; regole esistenti prioritarie e house rule separate/versionate. Fonte e versione persistite su regole e storico. |
| Autorita V1 | Preview, apply, override e risoluzione legacy consentiti soltanto al DM. |
| Ambito | Flusso guidato; automatizzare solo derivati coperti da regole strutturate. |
| Classe primaria | Prima classe acquisita, non ordinamento UI; immutabile nel normale level-up. |
| Chiavi classe | Chiavi stabili non localizzate (`fighter`, `wizard`, `warlock`); etichette e alias servono solo a input/display. |
| Prerequisiti | Regole multiclass 2014 data-driven per classe posseduta e destinazione; override DM solo motivato e storicizzato. |
| PF | House rule: ogni level-up assegna il valore pieno del Dado Vita della classe incrementata + modificatore COS. Ogni livello registra `HOUSE_RULE_MAX`, dado della classe, COS applicata e incremento effettivo. Una variazione futura della COS aggiorna retroattivamente i PF massimi secondo SRD, conservando lo storico del valore originario e dell'adeguamento. |
| Dadi Vita | Totali e residui distinti per taglia `d6`, `d8`, `d10`, `d12`; nessuna deduzione da una stringa di classe composta. |
| Riposi | House rule `rest-v1`: massimo 2 riposi brevi tra due lunghi; il breve spende automaticamente fino a meta dei Dadi Vita massimi, con un budget minimo di 1 dado quando il massimo e positivo, usa per ogni dado la media fissa + COS e si ferma quando i PF mancanti sono coperti. Il lungo ripristina tutti i Dadi Vita e azzera il contatore. Nessun tiro/input manuale, vincolo di 24 ore o blocco per PF iniziali a zero. |
| Spellcasting | Pool condiviso basato su contributi full + `floor(half/2)` + `floor(third/3)` per singola classe/sottoclasse. |
| Pact Magic | Pool separato derivato soltanto dai livelli Warlock, con reset breve; non contribuisce al caster level condiviso. |
| Risorse di classe | Pool `CLASS_RESOURCE` separati con propria reset policy; le manovre non sono slot incantesimo. |
| Sottoclassi | Soglia appartenente a ogni `ClassRule` e valutata sul livello di quella classe. Un legacy oltre soglia senza scelta resta `INCOMPLETE_LEGACY`. |
| Classi custom | Solo regole custom strutturate; campi mancanti producono warning/stato manuale, mai default inventati. |

## Censimento locale read-only

Il controllo e stato eseguito contro `prisma/migration.db` aperto in modalita read-only. Il database locale e utile per lo sviluppo ma non rappresenta i dati canonici Railway. Contiene 6 personaggi: 5 PG e 1 PNG; 4 PG sono attivi, un PG e un PNG sono archiviati.

| PG | Colonna classe/livello | JSON classe/livello | Dado Vita | Pool attivo osservato | Interpretazione |
| --- | --- | --- | --- | --- | --- |
| `aros` | Guerriero 5 | Guerriero 5 | `1d10` | livello 8, 4 unita | Manovre Guerriero memorizzate impropriamente come slot |
| `kael-varyn` | Ladro 5 | Ladro 5 | `1d8` | nessuno | Non incantatore nel dato corrente |
| `narak` | Bardo 5 | Bardo 5 | `1d8` | 4/3/2 ai livelli 1/2/3 | Spellcasting pieno; stato usato presente |
| `valthor` | Warlock 5 | Warlock 5 | `1d8` | 2 al livello 3 | Pact Magic, non pool Spellcasting condiviso |

Risultati aggregati:

- divergenze classe/livello colonne-JSON: `0/6`; JSON non validi: `0/6`;
- classi vuote, composte o custom: `0/6`; le classi osservate sono Bardo, Ladro, Guerriero e Warlock;
- i 4 PG attivi hanno `restState.maxHitDice = 5` e `hitDiceRemaining = 5` in forma aggregata; il PG e il PNG archiviati non hanno `restState` e non devono essere inizializzati con una scrittura implicita;
- `data.spells` e vuoto o assente, mentre le magie vivono in `data.features`: la provenienza non e inferibile in sicurezza;
- le 35 feature osservate hanno solo nome/descrizione. I titoli hanno attualmente un pattern classe/livello, ma includono manovre e magie di origine diversa dalla classe primaria: il parsing puo generare soltanto candidati assistiti;
- le 23 capability osservate hanno forme opzionali `passiveEffects` e `usage`; definizione e stato consumato dovranno essere separati preservando entrambi verbatim durante la transizione.

## Contratti legacy da congelare

Fino al cutover del writer:

1. `Character.level` resta la proiezione del livello totale.
2. `Character.className` resta la proiezione della classe primaria/iniziale.
3. `data.basicInfo.level` e `data.basicInfo.class` espongono le stesse proiezioni ai consumer esistenti.
4. Le colonne SQLite continuano a prevalere in lettura; una divergenza viene segnalata e non corretta silenziosamente.
5. Le nuove API aggiungeranno `classes[]` e `totalLevel` senza rimuovere i campi legacy.
6. PF correnti/massimi, slot usati e risorse consumate sono stato effettivo da preservare, non valori da rigenerare durante il backfill.
7. Feature/incantesimi testuali non vengono parsati per determinare classe, livello, provenienza o caster profile.

Consumer da migrare per gruppi, mantenendo inizialmente la proiezione:

| Gruppo | Consumer principali | Strategia |
| --- | --- | --- |
| Lettura/scrittura canonica | `server.js`, importer JSON | Introdurre un solo projector dal modello nuovo verso campi legacy. |
| Calcoli derivati | `src/utils.ts`, `src/lib/character-combat-rules.ts`, `src/lib/character-derived-stats.ts` | Usare `totalLevel` e resolver per classe; vietare parsing di etichette composte. |
| Scheda | header, PF, feature, attacchi/competenze | Mostrare `classes[]`; conservare fallback legacy durante la transizione. |
| Dashboard e tracker | `Index`, `DMDashboard`, `InitiativeTracker` | Consumare una summary server-side comune per PB, CD e risorse. |
| Riposi | endpoint server e modale roster DM | Passare da un contatore aggregato a pool per taglia senza cambiare i PF effettivi. |
| Risorse | feature scheda, conversione slot, riepiloghi | Separare `SPELLCASTING`, `PACT_MAGIC` e `CLASS_RESOURCE` prima di automatizzare il multiclasse. |

### Importatore storico da escludere da M3

`scripts/import-json-to-sqlite.mjs` non e un percorso sicuro per il backfill: punta a `src/data/characters`, mentre i dati storici vivono sotto `src/data/JSON_LEGACY/characters`, e genera SQL con cancellazioni estese prima del reinserimento. Non deve essere eseguito sul DB di sviluppo o produzione per preparare la progressione. M3 usera uno script additivo/idempotente con dry-run e conteggi su copia disposable; l'importatore legacy andra ritirato o riscritto in un task separato.

## Fixture e casi attesi disposable

| ID | Caso | Invarianti principali |
| --- | --- | --- |
| `mono-barbarian-5` | Barbaro 5, COS +2, house rule dado pieno a ogni livello | totale 5, PB +3, DV `{d12:5}`, PF storici 70 |
| `mono-wizard-subclass` | Mago 1 -> 2 | la preview richiede una sottoclasse Mago; nessun apply senza scelta valida |
| `legacy-cleric-missing-subclass` | Chierico legacy 4 senza dominio | backfill monoclasse, stato `INCOMPLETE_LEGACY`, nessuna scelta inventata |
| `full-full` | Mago 3 / Chierico 2 | caster level 5, slot condivisi 4/3/2, DV `{d6:3,d8:2}` |
| `full-half` | Mago 3 / Paladino 4 | caster level `3 + floor(4/2) = 5`, DV `{d6:3,d10:4}` |
| `half-half-rounding` | Paladino 2 / Ranger 3 | arrotondamento per classe: caster level 2, non arrotondamento finale |
| `full-third` | Mago 3 / Cavaliere Mistico 3 strutturato | caster level 4; manovre escluse dagli slot condivisi |
| `warlock-plus-caster` | Warlock 5 / Mago 3 | Spellcasting 4/2 separato da Pact Magic: 2 slot di 3o; DV `{d8:5,d6:3}` |
| `subclasses-independent` | Mago 2 / Paladino 2 | soglie calcolate per classe, mai sul livello totale |
| `prerequisite-reject` | Mago con CHA 12 tenta Paladino | rifiuto; override ammesso solo con motivazione e storico |
| `custom-manual` | Classe custom parziale + Mago 1 | nessun default inventato; warning manuale e solo contributi noti |
| `unresolved-legacy` | classe composta o livello colonna/JSON divergente | nessun backfill automatico; stato esplicito e intervento DM |
| `limits-and-integrity` | totale >20, duplicato classe, sottoclasse incoerente | rifiuto atomico e nessuna scrittura parziale |

I casi relativi a chiavi, totale/PB, Dadi Vita, full/full, full/half, half/half, third-caster, Warlock + caster, soglie, prerequisiti, limiti e custom manuali sono ora fixture eseguibili di M2.1 in `tests/rules/character-class-rules.test.mjs`. Storico PF, scelte di progressione e stato legacy restano da trasformare in fixture quando esisteranno i relativi resolver.

## Decisioni chiuse e dati ancora da censire

Le decisioni di prodotto D0 sono chiuse. Restano attivita di catalogazione tecnica, non scelte bloccanti:

1. catalogo strutturato dei prerequisiti multiclass e delle sottoclassi third-caster, che non puo essere derivato da `primary_abilities` o dai titoli delle feature;
2. censimento dei conflitti puntuali tra comportamento esistente e SRD, da presentare senza cambiare automaticamente le house rule;
3. rappresentazione dello storico degli adeguamenti retroattivi della COS senza perdere il valore PF applicato al momento di ciascun level-up.

## Uscita M0 e passo successivo

Il censimento, la matrice consumer, i casi attesi e D0 sono completi per i dati locali:

1. M1 completato con coordinatore iniettabile, test SQLite e receipt durevoli per retry di riposi/conversioni;
2. M2.1 completato con tipi condivisi, chiavi stabili, catalogo regole e resolver puri; completare ora catalogo/progressioni M2.2;
3. progettare M3 come migrazione additiva, idempotente e restart-safe, senza usare `prisma migrate status` come prova sul DB storico e senza toccare Railway prima di una release autorizzata.
