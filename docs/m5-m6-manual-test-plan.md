# Collaudo manuale M5/M6

Prerequisiti: app locale avviata su `dev`, accesso DM e nessun uso di Railway.

Esito 2026-09-23: TC01-TC05, TC07 e TC08 superati. TC06 e non bloccante per questa milestone ed e coperto dalle verifiche tecniche; il collaudo UI del level-up appartiene a L1.

## TC01 - Proiezioni migrate

1. Aprire Aros e verificare il riepilogo Dadi Vita strutturato (`residui/massimi d10`).
2. Verificare che le manovre compaiano come risorsa di classe, non come Spellcasting.
3. Aprire Narak e verificare che gli slot consumati siano invariati; il livello 3 deve conservare il massimo legacy effettivo senza resize automatico.
4. Aprire Valthor e verificare l'etichetta `Magia del Patto` e l'assenza dell'azione di conversione Spellcasting.

## TC02 - Mutazioni PF

1. Su un PG applicare danno, cura e PF temporanei.
2. Ricaricare la pagina e aprire la stessa scheda in un secondo browser.
3. Verificare persistenza e aggiornamento realtime senza cambi a PF massimi o Dadi Vita.
4. Cambiare Costituzione oltre una soglia di modificatore: PF massimi e correnti devono variare di `delta modificatore × livello`; ricaricare e verificare la persistenza.
5. Ripetere su un personaggio `LEGACY_MANUAL`: il valore effettivo migrato resta la base e riceve lo stesso delta deterministico, senza ricostruire o sostituire lo storico precedente.

## TC03 - Riposo breve

1. Portare un PG sotto i PF massimi e consumare almeno una risorsa a recupero breve.
2. Dalla dashboard DM aprire l'anteprima del riposo breve.
3. Verificare PF curati, Dadi Vita spesi per taglia e pool risorse indicati.
4. Applicare e verificare scheda, dashboard, secondo browser e persistenza dopo riavvio.
5. Verificare che il terzo riposo breve sia bloccato.

## TC04 - Riposo lungo

1. Preparare PF mancanti, PF temporanei, TS morte, Dadi Vita e risorse consumate.
2. Applicare il riposo lungo.
3. Verificare PF al massimo, temporanei e TS morte a zero, tutti i pool Dadi Vita pieni e reset delle sole risorse con policy breve/lunga.

## TC05 - Conversione pool

1. Su Narak consumare uno slot bersaglio e predisporre slot inferiori disponibili.
2. Eseguire la conversione e verificare sacrifici, recupero, realtime e persistenza.
3. Verificare che la conversione non sia disponibile per Valthor/Pact Magic e per le manovre di Aros.
4. Dove sono presenti piu pool, consumare/ripristinare un uso in ciascun riquadro e verificare che l'altro pool resti invariato anche nel secondo browser e dopo ricarica.

## TC06 - Integrazione API level-up (tecnico, non bloccante per il collaudo UI M5/M6)

M5/M6 non espongono ancora un pulsante di level-up. M4 fornisce gli endpoint DM-only di preview/apply e M5/M6 vi collegano PF, Dadi Vita e risorse; l'azione UI `Aumenta livello` appartiene alla milestone successiva L1. Questo caso e coperto dai test automatici server/database e puo essere ripetuto manualmente soltanto via API su un PG temporaneo.

1. Scegliere un PG di prova con revisione corrente.
2. Verificare in preview: PF ottenuti = Dado Vita pieno + COS (minimo 1), incremento del pool corretto, massimi risorsa dopo il livello.
3. Applicare una volta e verificare PF, Dadi Vita, risorse, storico e realtime.
4. Ripetere lo stesso request ID: deve restituire la receipt senza una seconda scrittura.
5. Provare revisioni obsolete e request ID riusato con payload diverso: entrambi devono essere rifiutati.

## TC07 - Nuova scheda

1. Creare un PG temporaneo di classe nota.
2. Verificare PF iniziali pari al Dado Vita pieno + COS, un Dado Vita disponibile e l'eventuale pool magia corretto.
3. Eliminare/archiviare il PG temporaneo e verificare che le righe M5/M6 correlate seguano il personaggio senza residui.

## TC08 - Nessuna scrittura implicita

1. Annotare PF, Dadi Vita e risorse di un PG.
2. Aprire/chiudere ripetutamente scheda, home e dashboard, poi riavviare il server.
3. Verificare che i valori non cambino senza un comando esplicito.
