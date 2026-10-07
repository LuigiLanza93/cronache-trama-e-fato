# Collaudo della creazione guidata di un PG di livello 1

> Aggiornamento 2026-10-02: preview autorevole, diario delle decisioni e concessioni,
> background personalizzato e varianti, risorse iniziali integrate. Database locale
> allineato; nessuna modifica Railway. [Checkpoint corrente](rules-inventory/implementation-step-two.md).
> Le verifiche datate nei paragrafi precedenti descrivono incrementi storici.

Primo incremento del contratto: verificare strumento posseduto del Bardo
distinto dalle competenze, lingue automatiche Druido/Stregone, expertise da
talento, dettagli e alias del libro del Mago e liste corrette Warlock.
[Casi e limiti](rules-inventory/implementation-step-one.md). P1 245/245
automatico non sostituisce il collaudo browser.

## Checkpoint al 2026-10-01

L'utente ha provato la creazione di un Ladro, dato riscontro positivo sul flusso e confermato la visualizzazione delle magie per livello dopo le correzioni. Il collaudo completo delle combinazioni e delle ultime correzioni Warlock resta aperto; questi riscontri non valgono come esecuzione di tutti i casi qui elencati. Ultimo checkpoint automatico della chat (2026-09-28): P1 224/224, TypeScript app e build superati, senza nuova esecuzione applicativa per l'aggiornamento documentale.

Lo [stato della feature](character-creation-level-one.md) distingue implementazione e limiti. Prima di aggiungere altre scelte è richiesto il censimento delle regole di tutte le razze/classi e la valutazione del [modello comune](character-creation-progression-model-audit.md); il level up completo dei contenuti non è ancora disponibile.

## Preparazione

- Avviare l'app locale su `dev` con `npm.cmd run dev`; usare un account DM.
- Verificare che `npm.cmd run creation:level-one:dry-run` riporti `after: true` sul DB locale. Se `false`, applicare `npm.cmd run creation:level-one:apply-local` prima di avviare l'app.
- Creare schede di prova nuove: i PG preesistenti mantengono la creazione legacy.

## Casi da provare

1. Aprire **Crea Scheda**. Il PG usa il wizard; il PNG mantiene il form precedente.
2. Scegliere una razza con sottorazza (per esempio Elfo Alto), una classe e l'allineamento. La sottorazza è obbligatoria e cambiare razza azzera le scelte razziali incompatibili.
3. Distribuire i 27 punti con il costo 8–15 del manuale. Il passaggio resta bloccato finché il totale non è 27; i bonus razziali sono mostrati separatamente.
4. Scegliere un background e completare abilità, lingue, strumenti, equipaggiamento, privilegi di classe e incantesimi richiesti. Le lingue e competenze automatiche devono comparire nel riepilogo/scheda senza essere richieste di nuovo. Completare due tratti della personalità, ideale, legame e difetto.
5. Creare almeno: un Chierico con Dominio della Conoscenza/Natura, uno Stregone o Warlock con sottoclasse al livello 1, un Mago con libro e incantesimi preparati, un Bardo con strumenti, e una razza con scelte extra (Mezzelfo/Dragonide/Umano variante).
6. Aprire ogni nuova scheda e verificare caratteristiche finali, PF e Dado Vita, bonus di competenza, abilità, lingue, privilegi del background, storia, equipaggiamento nell'inventario, valuta iniziale e progressione strutturata. Gli oggetti iniziali entrano nell'inventario senza essere equipaggiati: equipaggiare armatura, scudo e armi nella scheda e controllare i valori derivati. In un'anteprima di level up, la sottoclasse già scelta non deve essere chiesta una seconda volta.
7. Provare una scelta duplicata o non consentita: il wizard mostra l'errore e il server non crea alcuna scheda parziale.
8. Verificare che il PG creato dal DM sia inizialmente non assegnato e che il PNG continui a crearsi come prima.
9. Ripetere una richiesta identica con lo stesso identificativo dopo una risposta ambigua: deve tornare la stessa scheda. Lo stesso identificativo con dati diversi deve ricevere un conflitto.
10. Aprire anche un PG guidato creato prima dell'integrazione dei privilegi (per esempio un Ladro Halfling). La card **Privilegi di origine** deve essere inizialmente chiusa; aprendola, i gruppi Razza, Classe e Background e le singole voci devono potersi espandere separatamente. Le vecchie voci generate automaticamente non devono più riempire **Tratti e abilità** e i privilegi non devono appesantire **Skills**. Eventuali tratti modificati manualmente devono restare visibili. Competenza ed expertise devono conservare il grado corretto nell'elenco delle abilità. Chiudere di nuovo la card e verificare che gli effetti automatici continuino ad applicarsi.
10a. Nel wizard scegliere Ladro + Criminale: la scelta **Scegli uno strumento alternativo** deve spiegare che entrambi concedono gli arnesi da scasso. Cambiare il background in Accolito: la scelta alternativa deve scomparire. Nel PG creato, la competenza scelta deve comparire sotto **Alternative ai doppioni**.
10b. Nel wizard scegliere Mago o Chierico. Accanto a ciascun trucchetto e incantesimo, aprire **Leggi dettagli**: devono comparire livello/scuola, tempo di lancio, gittata, componenti, durata e descrizione quando presenti nel catalogo. Aprire e richiudere il dettaglio senza cambiare la selezione; verificare anche gli incantesimi preparati del Mago dopo la scelta del libro.
10c. Creare il Mago con trucchetti, libro e incantesimi preparati, poi aprire la scheda e la sezione **Tratti e Abilità**: le scelte devono comparire nelle sezioni **Trucchetti** e **Livello 1**, insieme agli incantesimi aggiunti manualmente, e aprire il dettaglio. La card indica se una scelta è nel libro o era preparata alla creazione. Controllare anche un PG guidato creato prima di questa correzione, un Chierico del Dominio della Luce (Luce e incantesimi di dominio), una razza con trucchetto fisso e un Umano variante con Incantatore Rituale (Libro dei rituali). Le scelte guidate devono restare visibili anche quando lo stesso incantesimo è stato aggiunto manualmente alla scheda. «Preparati alla creazione» riporta la scelta iniziale e non rappresenta ancora i cambi successivi ai riposi lunghi.
10d. Aprire **Privilegi di origine** su un Ladro Halfling Criminale già creato e su nuovi PG con razze, classi, domini e background diversi. Espandere i singoli privilegi: devono mostrare condizioni, benefici, limiti e utilizzi del 1° livello, senza rimandi generici al manuale. Per un Dragonide controllare che Discendenza Draconica, Arma a Soffio e Resistenza riportino il tipo di drago selezionato e il tiro salvezza corretto; per un Umano variante verificare il testo completo del talento e le sue scelte.
10e. Creare un Warlock: i patroni devono apparire come **Il Signore Fatato**, **L'Immondo** e **Il Grande Antico**. Sceglierli a turno e verificare che ciascuno aggiunga soltanto i suoi due incantesimi di 1° livello all'elenco selezionabile, mantenendo due incantesimi conosciuti; cambiare patrono deve azzerare la scelta degli incantesimi. Nella scheda di livello 1 la Lama del Patto non deve comparire. Su fixture di almeno 3 livelli Warlock con **Patto della Lama** registrato deve comparire; senza il patto deve restare nascosta. Questo verifica l'idoneità della scheda, non una scelta guidata del Dono del Patto, che resta da implementare.
10f. Su fixture multiclasse, controllare i livelli Warlock effettivi: Ladro 3/Warlock 3 con Patto della Lama è idoneo; Warlock 1/Guerriero 2 non è idoneo anche se il livello totale è 3. Una Lama virtuale salvata su un PG non idoneo non deve apparire nell'inventario o negli attacchi; una normale arma fisica posseduta resta nell'inventario. Controllare anche il Warlock legacy con **Lama Assetata** già registrata.
11. Per un Guerriero con stile Difesa, equipaggiare un'armatura e verificare il bonus passivo di +1 CA. Per un Nano delle Montagne, verificare la competenza razziale nelle armature leggere e medie. Il Ladro deve mostrare anche Gergo Ladresco tra i linguaggi.
12. Per un Monaco senza armatura e scudo verificare CA 10 + DES + SAG; per uno Stregone di Discendenza Draconica senza armatura verificare CA 13 + DES. Il valore deve coincidere tra scheda e riepiloghi. Un Nano delle Colline di livello 1 deve avere 1 PF in più e un Umano variante con Robusto 2 PF in più rispetto ai soli dado vita e Costituzione.

## Confine del collaudo

Vigore Immondo è una Supplica Occulta disponibile dal livello Warlock 2 a chi la sceglie, con qualsiasi patrono. Concede Vita Falsata a volontà come incantesimo di 1° livello su sé stessi, senza slot/componenti materiali. Non deve essere richiesta fra i trucchetti o concessa automaticamente dal patrono Immondo nella creazione di livello 1.

I dati del DB locale sono separati dai dati Railway. Questo collaudo non autorizza commit, push o rilascio in produzione; la conferma dell'utente è necessaria per il commit su `dev` secondo `AGENTS.md`.
