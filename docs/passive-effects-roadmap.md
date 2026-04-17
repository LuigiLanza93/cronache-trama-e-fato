# Passive Effects Roadmap

Questa roadmap serve come riferimento operativo per completare il supporto agli effetti passivi di skill e feature derivate da oggetti equipaggiati.

## Obiettivo

L'obiettivo non e' costruire subito un motore unico e totalizzante. La strategia consigliata e':

1. definire una risoluzione comune minima per capire quali effetti passivi sono attivi;
2. applicare ogni gruppo di target nel punto del codice che governa gia' quel valore;
3. chiarire fase per fase le regole di business prima di implementare;
4. aggiungere test mirati per ogni gruppo, evitando regressioni su CA, iniziativa e velocita'.

## Convenzioni

- `CUSTOM` e' solo descrittivo.
- Ogni passive effect puo' essere:
  - ignorato dal motore;
  - descritto in UI;
  - applicato automaticamente.
- Le feature passive degli oggetti equipaggiati devono seguire la stessa logica delle capability passive del personaggio, ma senza forzare per ora un mega-motore centralizzato.

## Stato attuale sintetico

### Target oggi gestiti

Base scheda:
- `ARMOR_CLASS`
- `SPEED`
- `INITIATIVE`
- `HIT_POINT_MAX`

Caratteristiche:
- `STRENGTH_SCORE`
- `DEXTERITY_SCORE`
- `CONSTITUTION_SCORE`
- `INTELLIGENCE_SCORE`
- `WISDOM_SCORE`
- `CHARISMA_SCORE`

Tiri per colpire:
- `ATTACK_ROLL`
- `MELEE_ATTACK_ROLL`
- `RANGED_ATTACK_ROLL`
- `UNARMED_ATTACK_ROLL`

Danni:
- `DAMAGE_ROLL`
- `MELEE_DAMAGE_ROLL`
- `RANGED_DAMAGE_ROLL`
- `UNARMED_DAMAGE_ROLL`
- `OFF_HAND_DAMAGE_ROLL`

Descrittivo soltanto:
- `CUSTOM`

### Target oggi non gestiti

- nessuno tra quelli oggi censiti nel modello

### Trigger oggi gestiti

- `ALWAYS`
- `WHILE_ARMORED`
- `WHILE_SHIELD_EQUIPPED`
- `WHILE_WIELDING_SINGLE_MELEE_WEAPON`
- `WHILE_DUAL_WIELDING`
- `WHILE_WIELDING_TWO_HANDED_WEAPON`

### Trigger oggi non gestiti

- nessuno tra quelli automatici oggi censiti
- `CUSTOM` resta solo descrittivo

## Roadmap per fasi

## Fase 0 - Preparazione

Obiettivo:
- fissare le regole minime e il perimetro dell'automazione.

Decisioni confermate:
- `CUSTOM` resta selezionabile in UI, visibile come testo o nota, ma sempre e solo descrittivo;
- `CUSTOM` non modifica mai valori numerici;
- target e trigger non ancora supportati vengono ignorati silenziosamente;
- l'obiettivo resta implementare progressivamente tutti i target e trigger mancanti;
- le fasi da 1 a 4 possono essere affrontate in qualsiasi ordine, mentre il consolidamento target e il lavoro sui trigger restano in coda;
- la strategia e il piano dei test saranno gestiti separatamente dall'utente.

Assunzione operativa:
- gli effetti passivi censiti nel sistema devono essere solo quelli automatici, cioe' quelli che modificano un valore numerico mostrato in scheda o usato nei calcoli applicativi;
- tutto cio' che non e' automatico non va modellato come passive effect e resta nella descrizione della spell o della feature;
- `CUSTOM` e' l'unica eccezione descrittiva, pensata come fallback per coprire casi non ancora gestiti dal sistema.

Output atteso:
- documentazione aggiornata;
- checklist di copertura target/trigger;
- perimetro funzionale chiarito.

## Fase 1 - Target Caratteristiche

Stato:
- implementata

Target inclusi:
- `STRENGTH_SCORE`
- `DEXTERITY_SCORE`
- `CONSTITUTION_SCORE`
- `INTELLIGENCE_SCORE`
- `WISDOM_SCORE`
- `CHARISMA_SCORE`

Obiettivo:
- decidere come gli effetti passivi modificano i punteggi caratteristica e tutti i derivati collegati.

Domande da chiarire prima di implementare:
- il bonus modifica il punteggio finale visibile o solo alcuni calcoli?
- il bonus si cumula sempre con altri effetti dello stesso tipo?
- sono ammessi malus?
- modificare una caratteristica deve aggiornare automaticamente prove, TS, attacchi, danni e altri derivati?
- per i target caratteristica sono consentiti anche value mode dinamici, ma senza combinazioni che introducano dipendenze ambigue o loop;
- non si sommano tra loro valori della stessa tipologia dinamica sullo stesso target in modi che rendano il calcolo ricorsivo o opaco;
- esempio esplicitamente escluso: sommare a `DEXTERITY_SCORE` il modificatore di `WISDOM`, se la combinazione non e' parte di una regola chiara e controllata.

Decisioni confermate per la Fase 1:
- il passive effect modifica il punteggio finale visibile in scheda;
- tutto cio' che deriva da quella caratteristica eredita il punteggio finale risolto;
- bonus e malus si trattano con la stessa logica aritmetica, senza gestione speciale;
- gli effetti valgono solo finche' il trigger e' valido e non modificano mai permanentemente il valore base;
- i target caratteristica possono usare formule dinamiche solo dove non introducono dipendenze tra caratteristiche;
- gli effetti che impongono un cap sulla stessa caratteristica si applicano in sequenza dal cap piu' basso al cap piu' alto;
- esempio guida: con `DES 18`, `+2 max 19` e poi `+2 max 21`, il risultato finale e' `21`;
- gli effetti che impostano una caratteristica a un valore fisso si applicano prima degli altri bonus;
- il set a valore fisso funziona come minimum floor applicato solo sul valore base, senza considerare i bonus;
- il valore modificato deve essere evidenziato in UI;
- deve essere possibile mostrare un dettaglio del risultato finale, in modo simile a quanto gia' avviene per CA, Iniziativa e Velocita';
- non deve essere possibile configurare una caratteristica che dipende da un'altra caratteristica o da se stessa;
- questa regola va bloccata sia in UI sia nel resolver per coprire eventuali dati legacy.

Direzione tecnica:
- introdurre una risoluzione dedicata ai punteggi caratteristica;
- usare i punteggi risolti nei componenti che dipendono dalle abilita', invece dei valori grezzi;
- evitare duplicazioni sparse nei componenti;
- prevedere un breakdown leggibile del calcolo finale per ogni caratteristica;
- distinguere concettualmente almeno questi passaggi:
  - valore base;
  - eventuale set a valore fisso;
  - bonus e malus applicati;
  - cap applicati in ordine.

Rischio:
- alto impatto trasversale.

### Specifica tecnica proposta

#### Obiettivo tecnico

Introdurre un resolver dedicato alle caratteristiche che:
- parta sempre dal valore base persistito in `characterData.abilityScores`;
- raccolga tutti i passive effects attivi che colpiscono una specifica caratteristica;
- produca un valore finale risolto;
- produca un breakdown leggibile per la UI;
- eviti di scrivere permanentemente il risultato dentro `abilityScores`.

#### Modello concettuale del risultato

Per ogni caratteristica il resolver dovrebbe restituire almeno:

- `baseScore`
- `resolvedScore`
- `isModified`
- `breakdown`
- `appliedEffects`

Forma orientativa:

```ts
type ResolvedAbilityScore = {
  ability: "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
  baseScore: number;
  resolvedScore: number;
  isModified: boolean;
  breakdown: Array<{
    kind: "base" | "set" | "bonus" | "cap";
    label: string;
    before?: number;
    delta?: number;
    after: number;
  }>;
  appliedEffects: any[];
};
```

Nota:
- la forma esatta puo' cambiare in implementazione;
- e' importante mantenere stabile soprattutto la distinzione tra base, set, bonus e cap.

#### Tipi di operazione da supportare

Per i target caratteristica servono tre famiglie logiche:

1. `SET`
   - imposta la caratteristica a un valore fisso;
   - si applica prima degli altri bonus;
   - serve per oggetti che portano una caratteristica a un valore minimo garantito.

2. `BONUS`
   - bonus o malus che modificano il punteggio;
   - comprendono `FLAT` e gli altri value mode ammessi, purche' non introducano loop o dipendenze opache.

3. `CAP`
   - tetto massimo applicato all'effetto o al valore corrente;
   - piu' cap sulla stessa caratteristica si applicano in ordine crescente.

#### Ordine di risoluzione proposto

Per una singola caratteristica:

1. leggere il valore base;
2. applicare gli effetti `SET`;
3. applicare i bonus e malus;
4. applicare i cap in ordine dal piu' basso al piu' alto;
5. produrre valore finale e breakdown.

Ordine guida:

```text
base -> set -> bonus/malus -> cap1 -> cap2 -> ... -> resolved
```

#### Regola per gli effetti `SET`

La decisione funzionale confermata e':
- il valore fisso avviene prima degli altri bonus.

Traduzione tecnica proposta:
- gli effetti `SET` non scrivono sul dato persistito;
- il resolver calcola un `workingScore` iniziale partendo dal base;
- i `SET` aggiornano il `workingScore` prima di ogni bonus.

Decisione applicata:
- se ci sono piu' `SET` sulla stessa caratteristica, viene applicato il valore impostato piu' alto tra quelli attivi;
- il comportamento resta coerente con il set inteso come minimum floor.

#### Regola per bonus e formule dinamiche

Consentiamo:
- `FLAT`
- `PROFICIENCY_BONUS`
- `CHARACTER_LEVEL`

Vincoli:
- il calcolo deve essere aciclico;
- niente formule che dipendono dal valore risolto della stessa caratteristica;
- niente combinazioni che rendano il risultato opaco;
- restano esclusi tutti i casi in cui una caratteristica dipenda da `ABILITY_MODIFIER` o `ABILITY_SCORE`, salvo futura regola esplicita.

Traduzione tecnica applicata:
- per i target caratteristica, le formule dinamiche leggono solo:
  - bonus competenza;
  - livello personaggio;
- non leggono altre caratteristiche, ne' base ne' risolte.

Questo elimina alla radice il rischio di loop tra caratteristiche.

#### Regola per i cap

Decisione funzionale confermata:
- i cap sulla stessa caratteristica si applicano in ordine crescente.

Caso guida:
- base `18`
- bonus `+2 max 19`
- bonus `+2 max 21`
- risultato finale `21`

Traduzione tecnica proposta:
- ogni effetto con cap porta con se' sia il delta sia il proprio limite;
- gli effetti capped si risolvono ordinandoli per `maxScore` crescente;
- ogni effetto capped parte dal valore corrente e applica il proprio incremento, fermandosi al proprio cap.

#### Impatto UI previsto

Per la Fase 1 non basta il calcolo. Servono anche segnali visivi minimi:

- evidenziare che una caratteristica e' modificata;
- permettere di aprire un dettaglio del calcolo;
- mostrare almeno:
  - valore base;
  - set applicato, se presente;
  - bonus e malus applicati;
  - cap applicati;
  - valore finale.

Implementazione minima consigliata:
- in `AbilityScores` aggiungere uno stato visivo per `isModified`;
- aggiungere un pannello o dettaglio espandibile simile alle card di CA, Iniziativa e Velocita'.

Implementazione realizzata:
- il riquadro modificato viene evidenziato visivamente;
- accanto alla sigla della caratteristica compare una piccola icona;
- il pulsante per aprire il dettaglio e' laterale, per non alterare la dimensione del riquadro;
- il breakdown mostra il percorso di calcolo del valore finale.

#### Punti del codice da coinvolgere

Il resolver delle caratteristiche dovra' alimentare almeno questi punti:

- `src/components/characterSheet/ability-scores.tsx`
  - per mostrare il punteggio finale e l'evidenza visiva della modifica;
- `src/utils.ts`
  - `calculateSkillValues` deve usare le caratteristiche risolte;
- `src/components/characterSheet/proficiencies.tsx`
  - tiri salvezza;
  - CD incantesimi;
  - percezione passiva;
- `src/components/characterSheet/combat-stats.tsx`
  - Destrezza per iniziativa;
  - Destrezza per CA quando la formula lo richiede;
- `src/components/characterSheet/hit-points.tsx`
  - Costituzione per il calcolo PF;
- `src/components/characterSheet/attacks-and-spells.tsx`
  - attacchi e danni basati sulla caratteristica.

#### Strategia di implementazione consigliata

Ordine suggerito:

1. estrarre utility pure per leggere un punteggio caratteristica base;
2. creare un resolver per una singola caratteristica;
3. creare un resolver per tutte le caratteristiche;
4. aggiornare `AbilityScores` per usare il resolver;
5. aggiornare `calculateSkillValues` e `Proficiencies`;
6. aggiornare `CombatStats`, `HitPoints`, `AttacksAndSpells`;
7. aggiungere il breakdown UI minimo.

#### Nota su modello dati

Esito implementativo:
- il modello dei passive effects e' stato esteso con supporto a `SET` e `capValue`;
- non e' stata necessaria una migration DB, perche' `passiveEffects` era gia' serializzato come JSON libero;
- il breakdown viene calcolato runtime e non viene persistito;
- la propagazione del punteggio risolto e' stata collegata a skill, tiri salvezza, CD incantesimi, percezione passiva, CA, iniziativa, PF e attacchi basati sulla caratteristica.

## Fase 2 - Target Punti Ferita

Stato:
- implementata

Target inclusi:
- `HIT_POINT_MAX`

Obiettivo:
- integrare i passive effects nel calcolo dei PF massimi senza rompere il flusso attuale di aggiornamento PF.

Domande da chiarire prima di implementare:
- il bonus ai PF massimi e' sempre attivo quando l'effetto e' attivo?
- se cambia `CONSTITUTION_SCORE`, il massimo PF deve riflettersi automaticamente anche tramite quella variazione?
- se il massimo PF scende, i PF correnti devono essere ridotti al nuovo massimo?

Direzione tecnica:
- estrarre il calcolo del massimo PF in una funzione dedicata;
- far dipendere il massimo PF sia dalla formula base sia dagli effetti passivi;
- aggiornare il comportamento di cura e danni per usare il massimo risolto.

Rischio:
- medio, con attenzione ai side effect.

Decisioni e risultato implementato:
- `HIT_POINT_MAX` modifica direttamente il massimo finale visibile;
- gli effetti si sommano normalmente;
- sono supportate anche le formule gia' esistenti;
- `SET` e `CAP` non hanno semantica operativa sui PF massimi e vengono ignorati in questo contesto;
- i PF correnti non possono superare il massimo in nessun momento;
- se il massimo aumenta, i PF correnti non aumentano automaticamente;
- i PF temporanei restano separati;
- nel pannello di dettaglio PF vengono mostrati anche gli eventuali bonus al massimo.

## Fase 3 - Target Tiri per Colpire

Stato:
- implementata

Target inclusi:
- `ATTACK_ROLL`
- `MELEE_ATTACK_ROLL`
- `RANGED_ATTACK_ROLL`

Obiettivo:
- applicare i passive effects ai tiri per colpire degli attacchi equipaggiati.

Domande da chiarire prima di implementare:
- `ATTACK_ROLL` e' un bonus globale che si somma ai bonus specifici?
- gli attacchi `THROWN` vanno trattati come melee o ranged?
- gli attacchi speciali usano solo il bonus globale o anche quelli specifici?

Direzione tecnica:
- estendere il calcolo degli attacchi equipaggiati;
- classificare ogni attacco con un contesto coerente;
- sommare bonus globali e bonus specifici in modo prevedibile.

Rischio:
- medio.

Decisioni e risultato implementato:
- `ATTACK_ROLL` si somma ai bonus specifici;
- `THROWN` viene trattato come `RANGED`;
- `SPECIAL` usa solo `ATTACK_ROLL`;
- sono ammesse le formule gia' previste dal modello;
- il supporto vale solo per gli attacchi equipaggiati, non per i legacy;
- i bonus compaiono anche nel dettaglio formula del tiro per colpire.

## Fase 4 - Target Danni

Stato:
- implementata

Target inclusi:
- `DAMAGE_ROLL`
- `MELEE_DAMAGE_ROLL`
- `RANGED_DAMAGE_ROLL`
- `UNARMED_ATTACK_ROLL`
- `UNARMED_DAMAGE_ROLL`
- `OFF_HAND_DAMAGE_ROLL`

Obiettivo:
- applicare i passive effects ai danni, compreso il caso mano secondaria.

Domande da chiarire prima di implementare:
- `DAMAGE_ROLL` si somma sempre ai bonus specifici melee/ranged?
- `OFF_HAND_DAMAGE_ROLL` si applica solo alla vera mano secondaria?
- i malus ai danni sono consentiti?
- gli attacchi a distanza e quelli da lancio seguono regole diverse?

Direzione tecnica:
- estendere il builder del danno negli attacchi equipaggiati;
- introdurre una funzione che calcola il bonus danni per categoria;
- trattare off-hand come caso separato, esplicitamente definito.

Rischio:
- medio-alto.

Decisioni e risultato implementato:
- `DAMAGE_ROLL` si somma ai bonus specifici melee/ranged/off-hand quando pertinenti;
- `THROWN` viene trattato come `RANGED` anche per i danni;
- `OFF_HAND_DAMAGE_ROLL` vale solo quando ci sono due armi equipaggiate;
- il bonus off-hand si applica agli attacchi dell'arma in mano secondaria;
- se nella mano secondaria non c'e' un'arma, il bonus non si applica;
- se l'arma secondaria e' `THROWN`, il bonus off-hand si applica comunque;
- in UI le mani sono state rinominate come `mano principale` e `mano secondaria`, mantenendo `right/left` solo internamente;
- sotto la categoria `Mani` dell'equipaggiamento viene mostrata una distinzione discreta tra principale e secondaria;
- e' stato introdotto un attacco base `Colpo senz'armi` quando non ci sono armi equipaggiate e non esistono altri attacchi derivati;
- il colpo senz'armi usa: attacco da mischia, portata 1 quadretto, tiro per colpire = competenza + mod Forza, danno = 1 + mod Forza, danno contundente;
- sono stati aggiunti i target dedicati `UNARMED_ATTACK_ROLL` e `UNARMED_DAMAGE_ROLL`, trattati come gli altri target automatici.

## Fase 5 - Consolidamento Target

Stato:
- parzialmente completata / non prioritaria

Obiettivo:
- ripulire le implementazioni una volta che i gruppi principali sono stati chiariti e sviluppati.

Attivita':
- ridurre duplicazioni;
- estrarre utility piccole e mirate;
- aggiungere punti diagnostici per capire perche' un effetto e' stato applicato o ignorato;
- mantenere separata la logica di calcolo dai dettagli di rendering UI.

Nota:
- questa fase non richiede per forza un motore centralizzato unico; puo' bastare una libreria di resolver piccoli e composti.

Stato residuo reale:
- e' stata consolidata in `utils.ts` la parte condivisa piu' importante del motore:
  - valutazione dei trigger passivi;
  - risoluzione del valore scalare di un passive effect;
- `attacks-and-spells.tsx` usa ora queste utility condivise invece di mantenere copie locali della stessa logica;
- esistono ancora resolver distribuiti tra `utils.ts`, `combat-stats.tsx`, `hit-points.tsx` e `attacks-and-spells.tsx`;
- la logica e' coerente e stabile, ma non completamente centralizzata;
- il lavoro residuo e' oggi soprattutto refactor opzionale, non una lacuna funzionale.

## Fase 6 - Trigger

Stato:
- implementata

Trigger inclusi:
- `WHILE_WIELDING_SINGLE_MELEE_WEAPON`
- `WHILE_DUAL_WIELDING`
- `WHILE_WIELDING_TWO_HANDED_WEAPON`

Trigger esclusi dall'automazione:
- `CUSTOM`

Obiettivo:
- valutare i trigger di impugnatura e stato equipaggiamento senza accoppiare troppo la logica dei target.

Domande da chiarire prima di implementare:
- "single melee weapon" esclude o include lo scudo?
- "dual wielding" richiede due armi melee o basta avere due armi equipaggiate?
- un'arma versatile usata a due mani conta come `WHILE_WIELDING_TWO_HANDED_WEAPON`?
- gli attacchi `THROWN` influenzano questi trigger?

Direzione tecnica:
- costruire un `equipmentContext` comune;
- far dipendere la valutazione dei trigger da quel contesto;
- mantenere i trigger separati dal calcolo del valore numerico dell'effetto.

Rischio:
- medio.

Decisioni e risultato implementato:
- `WHILE_WIELDING_SINGLE_MELEE_WEAPON` vale quando e' equipaggiata esattamente una sola arma, quella arma ha attacco `MELEE_WEAPON` e non e' presente uno scudo;
- `WHILE_DUAL_WIELDING` vale quando sono equipaggiate due armi distinte, una in mano principale e una in mano secondaria;
- `WHILE_WIELDING_TWO_HANDED_WEAPON` vale quando una singola arma occupa entrambe le mani;
- `VERSATILE` conta come arma a una o due mani in base a come e' equipaggiata;
- `THROWN` per i trigger conta come distanza;
- `CUSTOM` resta escluso dall'automazione e solo descrittivo.

## Strategia test

Nota:
- la definizione e gestione operativa dei test verra' curata separatamente dall'utente;
- le sezioni sotto restano come riferimento progettuale, non come task immediato di questa fase.

## Test unitari

Copertura minima:
- risoluzione di `FLAT`;
- risoluzione di `ABILITY_MODIFIER`;
- risoluzione di `ABILITY_SCORE`;
- risoluzione di `PROFICIENCY_BONUS`;
- risoluzione di `CHARACTER_LEVEL`;
- gestione moltiplicatori e arrotondamenti;
- inclusione o esclusione dell'effetto in base al trigger;
- somma tra bonus globali e bonus specifici, quando prevista.

## Test per gruppo target

Caratteristiche:
- il bonus viene applicato al punteggio corretto;
- i derivati leggono il punteggio aggiornato;
- il malus, se consentito, segue la stessa logica.

Punti ferita:
- il massimo PF aumenta o diminuisce correttamente;
- i PF correnti vengono clampati correttamente;
- cura e danno rispettano il nuovo massimo.

Tiri per colpire:
- `ATTACK_ROLL` funziona come bonus globale;
- `MELEE_ATTACK_ROLL` e `RANGED_ATTACK_ROLL` si applicano correttamente al contesto giusto;
- il bonus finale e' coerente con arma, competenza e caratteristica.

Danni:
- `DAMAGE_ROLL` funziona come bonus globale;
- `MELEE_DAMAGE_ROLL` e `RANGED_DAMAGE_ROLL` si applicano correttamente;
- `OFF_HAND_DAMAGE_ROLL` colpisce solo il caso previsto.

## Test di integrazione

Copertura minima:
- feature passiva definita direttamente nella scheda personaggio;
- feature passiva derivata da oggetto equipaggiato;
- cambio equipaggiamento che attiva o disattiva l'effetto;
- cambio configurazione impugnatura che modifica il trigger;
- valori mostrati in UI coerenti con il calcolo.

## Test di regressione

Da mantenere sempre verdi:
- `ARMOR_CLASS` continua a funzionare;
- `SPEED` continua a funzionare;
- `INITIATIVE` continua a funzionare;
- `ALWAYS`, `WHILE_ARMORED`, `WHILE_SHIELD_EQUIPPED` non si rompono;
- `CUSTOM` resta visibile ma non cambia nessun numero.

## Modalita' di lavoro consigliata

Quando scegli una fase:

1. si chiariscono prima le regole di business del gruppo;
2. si fissano i casi test da coprire;
3. si implementa il gruppo;
4. si verifica che non ci siano regressioni sui gruppi gia' supportati;
5. si aggiorna questo file con eventuali decisioni emerse.

## Prossimo uso

Quando vuoi procedere, puoi indicare direttamente:

- `Fase 5`

Al momento non risultano altre fasi funzionali bloccanti: il lavoro residuo e' soprattutto refactor opzionale e manutenzione evolutiva.
