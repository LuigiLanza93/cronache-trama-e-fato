# MC1 — Piano di collaudo manuale

Stato: **checkpoint iniziale implementato, collaudo manuale non ancora eseguito**.

Perimetro del checkpoint:

- scelta tra classe posseduta e nuova classe nello stesso dialog L1;
- prerequisiti multiclass 2014 su classi possedute e destinazione;
- override DM motivato, firmato e storicizzato;
- inserimento atomico della nuova `CharacterClass` senza cambiare la classe primaria legacy;
- PF e Dado Vita attribuiti alla classe bersaglio;
- Spellcasting condiviso, Pact Magic separata e sottoclassi per classe;
- competenze automatiche in armi/armature dell'ingresso multiclass, con provenienza distinta;
- retry idempotente, revisioni, realtime e proiezioni plurali invariati.

Restano fuori da questo checkpoint e impediscono di dichiarare completata MC1: scelte strutturate di abilita/strumenti concesse all'ingresso, profili di incantesimi conosciuti/preparati e catalogo persistito dei privilegi con regole di cumulo. La UI li segnala ancora come passaggi manuali; non vengono dedotti dai titoli legacy.

## Preparazione

1. Avviare l'app locale su `dev` con `npm.cmd run dev`.
2. Usare un PG di sviluppo con progressione `READY` e stato M5/M6 pronto.
3. Tenere aperti un browser DM e, quando indicato, il browser del player assegnato.
4. Per casi distruttivi o ripetibili usare un PG fixture o una copia del DB locale.

## Casi

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

Avanzare due classi fino alle rispettive soglie. Ogni selezione deve offrire soltanto sottoclassi della classe bersaglio e non deve cambiare quella gia scelta per l'altra classe.

### TC08 — Conflitto, retry e rollback

Aprire due browser DM sulla stessa scheda. Applicare dal primo e confermare dal secondo con revisioni obsolete: nessuna scrittura parziale. Simulare poi un esito rete incerto e usare `Riprova stessa conferma`: deve tornare la stessa receipt senza un secondo livello.

### TC09 — Realtime e viste

Con il player collegato, applicare una nuova classe. Scheda, dashboard, roster e tracker devono continuare a mostrare livello totale e composizione completa senza refresh distruttivi.

## Esito da registrare

Per ogni caso annotare PG/fixture, classi prima/dopo, esito, eventuale messaggio e screenshot utile. Non committare o pushare finche il collaudo concordato non e positivo.
