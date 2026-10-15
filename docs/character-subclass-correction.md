# Registrazione e correzione della sottoclasse

La scheda di un PG esistente puo gia contenere tutti gli effetti della propria
sottoclasse, gestiti manualmente. L'azione **Imposta sottoclasse**, riservata al
DM, registra la scelta strutturata indipendentemente dal level-up. Per una
scelta gia presente, il DM puo correggerla indicando una motivazione.

## Comportamento

- La classe deve appartenere al PG e avere raggiunto la propria soglia di
  sottoclasse. La scelta deve appartenere a quella classe nel catalogo.
- Classe primaria, livelli, PF e Dadi Vita restano invariati. Privilegi,
  competenze, incantesimi, equipaggiamento e bonus gestiti manualmente non
  vengono aggiunti, rimossi o duplicati.
- Prima della conferma, l'anteprima mostra la sottoclasse attuale e quella
  richiesta, gli eventuali effetti sugli slot e le verifiche manuali richieste.
- I consumi e gli override manuali devono essere preservati. Eventuali risorse
  legacy non classificabili con certezza non vanno attribuite automaticamente
  alla nuova sottoclasse o duplicate in un nuovo pool.
- L'operazione ha un proprio storico durevole, distinto dai level-up. Le
  revisioni proteggono da modifiche concorrenti; un retry della stessa
  conferma riutilizza il medesimo identificativo.
- Per Discendenza Draconica dello Stregone si registra anche il drago antenato
  tra le dieci opzioni del Manuale del Giocatore, con il tipo di danno
  associato. La scelta puo essere completata senza level-up anche quando la
  sottoclasse e gia registrata. Cambiare un antenato gia presente richiede una
  motivazione. Nei normali level-up il valore scelto viene conservato.
- La scelta dello Stregone e distinta dall'eventuale discendenza razziale del
  Dragonide. Non viene dedotta dalle note o dalla razza, e non concede
  automaticamente bonus, privilegi o resistenze.

## Collaudo

### Warlock: patrono e dono del patto

Il patrono resta la sottoclasse del Warlock, disponibile dal livello 1.
Dal livello 3 **da Warlock**, il medesimo dialogo propone anche il dono del
patto: **Patto della Catena**, **Patto della Lama**, **Patto del Tomo**.
Il livello totale del multiclasse non anticipa questa soglia.

Le scelte sono indipendenti: il patrono esistente viene preselezionato e si
puo registrare solo il dono mancante, senza motivazione. Cambiare un patrono
o un dono gia registrato richiede una motivazione. Un dono gia scelto viene
conservato quando si corregge soltanto il patrono. Il normale level-up
richiede il dono se la classe Warlock arriva al livello 3 o lo ha gia
superato senza averlo registrato; non consente di cambiarne uno esistente.

`CharacterClass.pactBoonKey` conserva il dono separatamente da
`subclassRuleId`. `CharacterPactBoonHistory` registra prima/dopo, autore,
motivo e risultato nella stessa transazione delle revisioni e delle scelte.
Le richieste gia salvate senza il nuovo campo mantengono la firma precedente.
Le schede storiche restano senza dono finche il DM non lo registra: nessuna
scelta viene dedotta da privilegi, note o armi esistenti.

Il fix non concede automaticamente familiari, trucchetti, libri, privilegi,
slot o altre risorse. Lo stato storico `pactBlade` e l'inventario restano
conservati anche passando a un altro dono; sezione, arma virtuale e competenza
specifica dell'Arma del Patto sono attive solo con Warlock di livello 3 o
superiore e Patto della Lama registrato, anche in multiclasse. Le richieste
Socket.IO verificano gli stessi requisiti sulla progressione autorevole.

Collaudo aggiuntivo:

- Warlock 1-2: solo patrono; Warlock 3+: patrono e dono, con nomi distinti.
- Multiclasse con Warlock 2 e livello totale superiore a 3: nessun dono.
- Registrare un dono mancante senza cambiare patrono; ricaricare la scheda.
- Correggere il dono con motivazione: PF, DV, livelli e risorse invariati.
- Correggere solo il patrono: il dono resta registrato.
- Warlock 2 verso 3: scegliere il dono; passando poi a un'altra classe nel
  dialogo, la scelta temporanea del dono deve essere azzerata.
- Patto della Lama: sezione dell'arma disponibile anche con Warlock secondario.
  Passare a Catena/Tomo: dati conservati, arma virtuale e concessione specifica
  di competenza disattivate; tornare alla Lama ripristina l'accesso.

### Verifiche generali

1. Come DM, aprire un PG storico sopra soglia con sottoclasse mancante.
   Registrare quella gia posseduta: totale livelli, livelli di classe, PF,
   Dadi Vita e contenuti manuali devono restare identici.
2. Riaprire la scheda e verificare persistenza e disponibilita del level-up.
3. Correggere una sottoclasse esistente: senza motivazione non si puo
   confermare. Con motivazione, verificare storico e invarianti del punto 1.
4. Provare un PG multiclasse: solo le classi possedute sono disponibili e la
   correzione non deve modificare la sottoclasse dell'altra classe.
5. Provare una classe sotto soglia e una sottoclasse di un'altra classe: il
   server deve rifiutare entrambe, anche con richieste dirette.
6. Verificare un Ladro/Guerriero con slot gia gestiti manualmente e una
   sottoclasse incantatrice: niente slot duplicati, consumi azzerati o override
   persi. Esaminare l'anteprima e le eventuali indicazioni di verifica manuale.
7. Aprire due sessioni DM. Confermare dalla prima e tentare la vecchia
   anteprima dalla seconda: conflitto senza scritture parziali. Riprovare
   identica conferma dopo una risposta incerta: una sola voce nello storico.
8. Con player assegnato collegato, verificare aggiornamento della scheda.
   Richieste dirette preview/apply come player devono essere respinte.
9. Da Warlock con patrono gia registrato aggiungere Stregone 1. Nell'anteprima
   entrambe le classi devono mostrare la propria sottoclasse. Scegliere
   Discendenza Draconica e un drago; senza antenato la conferma resta bloccata.
   Dopo salvataggio e ricarica verificare patrono originale e antenato dello
   Stregone. Provare lo stesso percorso con Magia Selvaggia: niente scelta
   draconica.
10. Su Stregone draconico storico senza antenato, completare la scelta con
    **Correggi sottoclasse**, mantenendo la stessa sottoclasse e gli stessi
    livelli. Correggere poi il drago con motivazione e verificare lo storico;
    il successivo level-up deve conservare il valore.

## Rilascio

Per il dono del patto serve anche la migrazione additiva
`20261015_character_pact_boon`. In locale:
`npm.cmd run pact-boon:dry-run` e `npm.cmd run pact-boon:apply-local`.
Lo script supporta `--database` per le copie e rifiuta schemi parziali.
Il reader resta compatibile con schemi senza il nuovo campo; le scritture
del dono richiedono lo schema completo. La migrazione non assegna doni e non
modifica le vecchie colonne. Per Railway valgono backup fresco verificato,
writer fermi e autorizzazione esplicita previsti dal runbook; nessuna
migrazione di produzione e stata applicata durante questo intervento.

La funzionalita richiede una migrazione additiva dedicata allo storico, oltre
alla preparazione M3, M4, M5, M6 e MC1 delle schede esistenti. Il solo avvio del
server non applica le migrazioni. Gli endpoint devono rifiutare l'operazione se
lo schema necessario non e disponibile.

In locale: `npm.cmd run subclass:dry-run`, poi
`npm.cmd run subclass:apply-local`. Lo script
`scripts/apply-character-subclass-correction.mjs` accetta `--database` per
lavorare su copie isolate. La migrazione crea solo lo storico; non assegna
sottoclassi e non riscrive le schede. Riavviare il server dopo la preparazione.

L'antenato draconico richiede anche la migrazione additiva
`20261015_character_draconic_ancestry`, dopo lo storico delle sottoclassi:
`npm.cmd run draconic-ancestry:dry-run` e
`npm.cmd run draconic-ancestry:apply-local`. Aggiunge il campo dedicato della
classe e lo storico delle scelte. Gli antenati delle schede storiche restano
vuoti finche il DM non li registra esplicitamente. Anche questo script accetta
`--database` per le copie isolate; non viene eseguito all'avvio del server.

Il rilascio richiede autorizzazione esplicita, writer fermi, backup esterno
fresco verificato e prova della sequenza su una copia del database canonico
Railway. Interrompere la procedura su errori o schede irrisolte; controllare
integrita, foreign key, storico e flussi DM/player prima di riaprire i writer.
Il rollback applicativo puo lasciare la tabella additiva: non eliminare lo
storico per ripristinare il vecchio codice. Un ripristino dei dati richiede
una procedura distinta e autorizzata.
