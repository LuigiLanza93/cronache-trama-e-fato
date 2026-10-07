# Contratto proposto per creazione e progressione

Proposta del 2026-10-01, ricavata dagli inventari PHB di questa cartella.
Non è ancora uno schema Prisma né un motore applicativo. Definisce il
contratto da implementare e consente di verificare ogni famiglia di regole
prima di modificare i writer esistenti.

L'inventario descrive il PHB, mentre la roadmap conserva house rule già
decise: PF massimizzati ai level up e riposi personalizzati. Il ruleset
di campagna deve registrare queste differenze esplicitamente; adottare
il nuovo motore non autorizza a sostituirle con la regola del manuale.

## Definizioni versionate

| Oggetto | Campi minimi | Scopo |
| --- | --- | --- |
| RuleSet | ID, versione, manuale/revisione/hash, opzioni campagna | Distinguere PHB, correzioni OCR verificate e varianti della campagna |
| RuleDefinition | ID stabile, label italiana, descrizione completa, fonte, trigger, prerequisiti, decisioni, concessioni | Dati condivisi fra server e client; niente ID tecnici come label |
| DecisionDefinition | ID, tipo, cardinalità, pool, dipendenze, esclusioni, policy di sostituzione | Descrive una scelta; una concessione automatica non richiede una decisione fittizia |
| GrantDefinition | ID, tipo, destinatario/proprietà, formula/valore, condizioni, policy aggregazione | Competenze, capacità, magie, resistenze, statistiche e inventario |
| ResourceDefinition | ID, formula massimo, costo, recupero, scope proprietario/bersaglio | Usi, punti, dadi, slot, recuperi; separata dalla decisione di acquisizione |
| SourceReference | Manuale, pagina, righe, hash frammento, stato verificato/ambiguo | Rendere controllabile l'interpretazione e rilevare spostamenti della sorgente |

Gli ID esistenti sono preservati tramite mapping espliciti. Le magie richiedono
ID stabili, alias del catalogo e label italiane; un cambio della label non
deve cambiare l'identità. La descrizione viene mostrata per esteso nei
privilegi collassabili, con fonte consultabile come informazione aggiuntiva.

## Eventi e decisioni del personaggio

Eventi previsti: `creation`, `classLevelGain`, `totalLevelGain`,
`preparationChange`, `bookCopy`, `rest`, `manualAdjustment`.
Creazione e ingresso in una classe sono contesti differenti. Il livello
totale cresce una sola volta per level up, anche se scatena più regole.

Ogni evento confermato conserva ID, PG, sequenza, requestId, versione dello
stato precedente, ruleset, livelli prima/dopo e decisioni validate. Una
decisione registra `definitionId`, opzioni, provenienza, operazione
`acquire`/`replace`/`prepare`, eventuale decisione sostituita e evento.
La sostituzione chiude la decisione precedente e revoca solo le sue
concessioni, senza cancellarne la storia. Cambiare patrono nella bozza
ricalcola le scelte dipendenti e segnala quelle diventate incompatibili.

Preparazione corrente, impiego delle risorse e inventario sono stati
separati dalle decisioni permanenti. Il recupero di una risorsa non
riacquisisce il privilegio; il riposo non cambia da solo gli incantesimi
preparati senza una scelta del giocatore. Scegliere il Patto della Lama
non crea subito un'arma specifica permanente nell'inventario.

## Linguaggio di condizioni e formule

Usare un insieme chiuso di operatori validati: `all`, `any`, `not`,
`abilityAtLeast`, `classLevelAtLeast`, `totalLevelAtLeast`,
`hasProficiency`, `hasFeature`, `hasKnownSpell`, `campaignOption`.
Formule chiuse: costante, somma, moltiplicazione, minimo/massimo,
arrotondamento, lookup tabella e riferimenti a livelli/modificatori.
Niente JavaScript/config eseguibile o `eval` nelle definizioni.

I quattro livelli sono campi distinti: personaggio, classe, incantesimo,
slot usato. Le formule devono dichiarare quale leggono. Per esempio:

- Dragonide: soffio dalla tabella del livello totale, CD da COS/competenza.
- Guerriero: Attacco Extra dalla tabella del livello della classe.
- Incantatore Rituale: limite copia metà livello totale arrotondato in alto.
- Multiclasse: contributi slot arrotondati in basso come indicato dal manuale.
- Iniziato alla Magia: lista scelta e caratteristica associata, una magia di
  livello 1 con utilizzo dedicato; nessuna conversione in trucchetto.

## Pool e cardinalità

Pool interrogabili per ID: abilità, strumenti, lingue con accesso autorizzato,
armi, sottoclassi, talenti, incantesimi, manovre, suppliche, terreni, nemici,
elementi e opzioni narrative. I filtri leggono i dati completi del catalogo:
livello, scuola, rituale, tiro per colpire, classe e lista ampliata.

Cardinalità può essere fissa, variabile con min/max oppure formula. Servono
distinzione, esclusione di opzioni già possedute, scelta mista con limite
globale (Abile/background personalizzato), scelta annidata (classe magica
del talento → magie), e scelta per evento (Totem a livelli diversi).
I bonus alle caratteristiche si risolvono prima dei prerequisiti che
li usano, senza consentire dipendenze circolari o autoabilitazioni illegali.

La policy per competenza duplicata genera una scelta solo con conflitto
reale e mostra fonti e oggetto: «Arnesi da scasso concessi sia da Ladro
sia da Criminale: scegli un'altra competenza negli strumenti». Nome UI:
**Scelte per competenze già possedute**. Non trasformare automaticamente
lingua duplicata, maestria o competenza globale nelle armi in questa regola.

## Concessioni ed effetti sulla scheda

| Tipo | Informazione necessaria | Proiezione |
| --- | --- | --- |
| proficiency | Categoria, oggetto, moltiplicatore, condizione, provenienza | Competenze native e prove ammesse; mai sommare due volte lo stesso bonus |
| abilityIncrease | Caratteristica, incremento, massimo, dipendenza | Statistiche base/derivate, PF retroattivi dove richiesti |
| feature | Gruppo razza/classe/background/talento, testo, attivazione | Card privilegi collassabili; strumenti effetti condivisi con skill |
| spellAccess | Lista, ampliamento, filtri | Solo eleggibilità, non incantesimo automaticamente conosciuto |
| spellGrant | Incantesimo, ruolo noto/libro/preparato/sempre preparato/rituale/a volontà, caratteristica, costo slot/componenti, livello di lancio | Sezione incantesimi esistente raggruppata per livello, con provenienza/uso leggibili |
| statisticEffect | Proprietà, operazione, formula, condizione | CA, movimento, iniziativa, passive, resistenza ecc. |
| resource | Proprietario, massimo, stato corrente, recupero | Usi e risorse della capacità, senza conflitto con slot di altra fonte |
| equipment | Oggetto, quantità, monete, scelta dotazione/acquisto | Inventario; possedere un oggetto non significa esserne competente o averlo equipaggiato |

Un incantesimo posseduto da due fonti appare con entrambe le modalità di
lancio, pur mantenendo la consultazione raggruppata per livello. Le fonti
possono avere caratteristiche e consumi diversi; non deduplicare perdendo
un uso. Vantaggi condizionali richiedono condizioni leggibili e applicazione
assistita finché la scheda non conosce il contesto necessario.

## Persistenza e API da introdurre

Strutture dedicate proposte: registro eventi/decisioni, concessioni con
provenienza, preparazioni correnti e stato risorse. Valutare tabelle
`CharacterRuleEvent`, `CharacterRuleDecision`, `CharacterRuleGrant`,
`CharacterSpellPreparation`, `CharacterResourceState`. Nomi definitivi,
relazioni/indici e migrazione saranno parte del prossimo intervento.
`CharacterCreation` e `CharacterLevelHistory` restano snapshot storici;
`Character.data` resta legacy e non diventa il contenitore del nuovo modello.

API preview e conferma condividono lo stesso resolver: il client invia
decisioni, non bonus/PF/concessioni arbitrari. Il server rilegge ownership,
versione dello stato e regole, valida tutte le scelte, quindi scrive in
transazione. RequestId e vincolo evento/sequenza rendono i retry idempotenti;
una bozza su stato obsoleto richiede un nuovo preview. Conservare ACL
DM/player esistenti anche per preparazioni e risorse.

## Stato eseguibile

Passi 1–2 avviati: catalogo completo, validator comune, formule/condizioni
ed eventi iniziali di lingua. Il contratto resta più ampio del runtime;
dettagli e limiti nel [primo incremento](implementation-step-one.md).

## Compatibilità e ordine di implementazione

1. Separare le ambiguità OCR dalla fonte verificata e riallineare le liste
   magiche, preservando alias/ID; non usare automaticamente le righe ambigue.
2. Introdurre definizioni/validator/resolver puri e un adattatore della
   creazione attuale. Nessuna migrazione implicita dei PG già creati.
3. Aggiungere persistenza/API, transazioni e lettura compatibile dei vecchi
   snapshot. I privilegi manuali restano distinguibili dalle concessioni.
4. Collegare il wizard agli stessi dati e completare i casi di livello 1
   emersi nel censimento. Collaudo mirato sui casi delle classi/talenti.
5. Estendere eventi di classe 2–20, sostituzioni, preparazione e copia libri;
   verificare multiclasse e riposi prima di dichiarare il level up completo.

Gate di verifica: dipendenze annidate, cardinalità su caratteristiche variate,
revoca isolata durante sostituzione, patrono che amplia ma non concede,
risorse brevi/lunghe separate, soglie razziali in multiclasse, copie dei libri,
deduplica con provenienza, retry/concorrenza/ownership e vecchi PG senza
decisioni ricostruibili. I test devono verificare questi comportamenti,
non limitarsi a riprodurre le tabelle dei dati.
