# MC1 — Piano di collaudo manuale

Stato: **checkpoint iniziale collaudato; MC1 completato nel perimetro catalogo concordato**.

Perimetro del checkpoint:

- scelta tra classe posseduta e nuova classe nello stesso dialog L1;
- prerequisiti multiclass 2014 su classi possedute e destinazione;
- override DM motivato, firmato e storicizzato;
- inserimento atomico della nuova `CharacterClass` senza cambiare la classe primaria legacy;
- PF e Dado Vita attribuiti alla classe bersaglio;
- Spellcasting condiviso, Pact Magic separata e sottoclassi per classe;
- competenze automatiche in armi/armature dell'ingresso multiclass, con provenienza distinta;
- retry idempotente, revisioni, realtime e proiezioni plurali invariati.

Restano per M8 le scelte strutturate di abilita/strumenti concesse all'ingresso, i profili di incantesimi conosciuti/preparati e il catalogo persistito dei privilegi con regole di cumulo. La UI li segnala come passaggi manuali; non vengono dedotti dai titoli legacy.

## Preparazione

1. Avviare l'app locale su `dev` con `npm.cmd run dev`.
2. Usare un PG di sviluppo con progressione `READY` e stato M5/M6 pronto.
3. Tenere aperti un browser DM e, quando indicato, il browser del player assegnato.
4. Per casi distruttivi o ripetibili usare un PG fixture o una copia del DB locale.

## Casi

### TC00 — Schede storiche e preparazione del rilascio

Partire da una copia di un database legacy e applicare, con i writer fermi, la
sequenza M3 (catalogo e backfill), M4, M5, M6 e MC1. Sincronizzare il catalogo
con `--catalog-only` se gia migrato a MC1: non rieseguire il backfill monoclasse
M3 su progressioni multiclass. Prima di produzione servono il backup esterno
fresco verificato e le verifiche previste nelle procedure delle milestone.
Queste migrazioni non vengono applicate dall'avvio dell'app: il solo deploy
non prepara le schede remote. Un'uscita non zero, incluso il codice 2 per
schede `UNRESOLVED`, interrompe la sequenza anche se lo script ha gia applicato
parte del backfill. Risolvere i casi segnalati prima di proseguire o riaprire
i writer.

Verificare per ogni PG reale classe/livello strutturati, PF/Dadi Vita e risorse.
Gli stati irrisolti richiedono analisi esplicita; non assegnare sottoclassi
automaticamente e non ricalcolare i PF storici. `LEGACY_MANUAL` dei PF conserva
il valore effettivo e non impedisce i futuri avanzamenti.

Aprire **Aumenta livello** su una scheda gia oltre la soglia della sottoclasse,
con stato `INCOMPLETE_LEGACY`: deve caricare l'anteprima e offrire le sottoclassi
della classe avanzata. Senza scelta la conferma resta bloccata; selezionando
quella gia posseduta diventa disponibile. Verificare livello +1, sottoclasse
persistita, incremento dei PF senza ricostruire il passato, danni e consumi
preservati, storico, retry e aggiornamento player. Ripetere su una scheda con
sottoclasse gia registrata e per l'ingresso in una nuova classe idonea.

La scelta storica puo essere registrata anche prima di qualsiasi avanzamento
con **Imposta sottoclasse**, oppure corretta con motivazione se gia presente.
Seguire il [collaudo dedicato](./character-subclass-correction.md): l'azione
non aumenta il livello e non concede di nuovo effetti gia gestiti manualmente.
Il rilascio deve includere anche la migrazione dello storico delle sottoclassi.

Il test automatico `character-progression-m3.test.mjs` copre l'intera sequenza
su una fixture legacy fino all'anteprima MC1; non certifica lo stato Railway.

### TC01 — Regressione L1

Avanzare una classe gia posseduta. Verificare anteprima, conferma, PF, Dado Vita, risorse, storico e aggiornamento player come nel piano L1.

### TC02 — Aggiunta di una nuova classe idonea

Scegliere una classe non posseduta con prerequisiti soddisfatti. L'anteprima deve mostrare `nuova classe`, livello classe `0 -> 1`, totale `+1`, Dado Vita corretto e stato risorse coerente. Dopo la conferma, la classe primaria e la sua etichetta legacy non cambiano e la nuova classe compare in tutte le viste.

### TC03 — Prerequisiti falliti

Scegliere una classe per cui il PG non soddisfa almeno un requisito. La conferma deve restare bloccata e il motivo deve essere visibile.

### TC04 — Override DM

Sul caso TC03 inserire una motivazione e ricalcolare. La conferma deve diventare disponibile; storico e retry devono conservare esattamente la motivazione. Cambiare motivazione riutilizzando lo stesso request ID deve produrre conflitto.

### TC05 — Competenza d'ingresso

Con un Mago primario aggiungere Guerriero. Verificare competenza in armi marziali, armature medie e scudi, ma non armature pesanti. Il riepilogo deve indicare `Ingresso multiclasse: Guerriero`.

### TC06 — Spellcasting e Pact Magic

Provare full+full, full+half e Warlock+caster. Gli slot Spellcasting devono seguire il livello effettivo combinato; Pact Magic deve restare un pool distinto con reset breve.

### TC07 — Sottoclassi indipendenti

Avanzare due classi fino alle rispettive soglie. Ogni selezione deve offrire soltanto sottoclassi della classe bersaglio e non deve cambiare quella gia scelta per l'altra classe. Verificare anche il catalogo completo del Manuale del Giocatore 5.0: 40 sottoclassi in totale, fra cui 8 scuole del Mago, 7 domini del Chierico e 3 archetipi del Guerriero. L'antenato della Discendenza Draconica dello Stregone va scelto tra i dieci draghi del manuale: verificare blocco senza scelta, salvataggio e conservazione nei level-up successivi. Le altre scelte interne non ancora censite restano manuali. Nell'anteprima devono comparire le sottoclassi di tutte le classi, preservate affiancate.

### TC08 — Conflitto, retry e rollback

Aprire due browser DM sulla stessa scheda. Applicare dal primo e confermare dal secondo con revisioni obsolete: nessuna scrittura parziale. Simulare poi un esito rete incerto e usare `Riprova stessa conferma`: deve tornare la stessa receipt senza un secondo livello.

### TC09 — Realtime e viste

Con il player collegato, applicare una nuova classe. Scheda, dashboard, roster e tracker devono continuare a mostrare livello totale e composizione completa senza refresh distruttivi.

### TC10 — Skill passive: livello totale e livello di classe

Su un PG multiclasse, creare un effetto passivo scegliendo come valore
`Livello totale`, poi `Livello classe 1 — Nome` e `Livello classe 2 — Nome`.
Verificare che ciascuno usi il livello corrispondente, anche con frazioni,
arrotondamento e bonus fisso. Salvare, ricaricare e avanzare una classe:
solo gli effetti legati a quella classe devono cambiare, oltre agli effetti
basati sul totale. Il riferimento salvato e la chiave della classe, non
l'indice visualizzato. Se una classe non e piu disponibile, la scelta resta
esplicita come non disponibile e non viene sostituita con un'altra classe.
Gli effetti gia salvati come `CHARACTER_LEVEL` restano basati sul totale.

Provare il trigger `Finché non indossa un'armatura`: bonus attivo senza
armatura, disattivo dopo averla equipaggiata, di nuovo attivo rimuovendola.
Il solo scudo non conta come armatura per questo trigger. Controllare CA,
iniziativa, abilita e gli eventuali bonus ai PF, anche sul client player.
Le scelte restano nel JSON esistente. Per applicare i bonus ai PF massimi
serve anche la migrazione `20261015_character_passive_hit_points`, dopo M5:
registra la quota passiva gia inclusa nel massimo e impedisce somme ripetute.

Caso di regressione: Warlock 5 / Stregone 1, Costituzione 12, base 52 PF.
Un bonus ai PF massimi pari al livello dello Stregone deve mostrare 53/53.
Ricaricare e salvare piu volte: il massimo resta 53. Infliggere 4 danni,
ricaricare, curare e riposare: rispettivamente 49/53 e 53/53. Avanzare lo
Stregone al livello 2: massimo 61 (7 PF del livello e 1 del bonus passivo).
Rimuovere il bonus deve sottrarlo una sola volta; a 0 PF il cambiamento
del bonus non deve rialzare il personaggio. Conservare PF temporanei,
fallimenti/successi ai tiri salvezza e storico preesistente.

## Esito da registrare

Per ogni caso annotare PG/fixture, classi prima/dopo, esito, eventuale messaggio e screenshot utile. Non committare o pushare finche il collaudo concordato non e positivo.
