# Collaudo manuale L1

Prerequisiti: app locale avviata su `dev`, accesso DM e player in due browser distinti, nessun uso di Railway. Per i casi che applicano davvero un livello usare un PG temporaneo: il level-up e intenzionalmente permanente e viene registrato nello storico.

Esito 2026-09-23: collaudo manuale completato con esito positivo. Tutti i casi L1 concordati sono superati.

## TC01 - Visibilita e permessi

1. Come DM aprire la scheda di un PG monoclasse con progressione strutturata.
2. Verificare che sia disponibile l'azione `Aumenta livello` sulla classe posseduta.
3. Aprire la stessa scheda come player e verificare che l'azione non sia disponibile.
4. Verificare via chiamata diretta che gli endpoint DM di preview e apply rifiutino il player.

## TC02 - Anteprima completa senza scritture

1. Aprire il flusso su un PG temporaneo non alla soglia di sottoclasse.
2. Verificare il confronto prima/dopo di livello totale e di classe, bonus di competenza, PF, Dadi Vita, Spellcasting o Pact Magic e altre risorse presenti.
3. Verificare che competenze, privilegi e incantesimi non automatizzati siano indicati come passaggi manuali.
4. Chiudere il dialogo, ricaricare la scheda e verificare che nessun valore sia cambiato.

## TC03 - Sottoclasse obbligatoria

1. Usare un PG temporaneo il cui prossimo livello raggiunga la soglia di sottoclasse.
2. Verificare che la prima preview blocchi la conferma e mostri soltanto sottoclassi censite per la classe posseduta.
3. Selezionare una sottoclasse e verificare che la nuova preview diventi applicabile.
4. Applicare e verificare che classe, sottoclasse e livello siano coerenti dopo ricarica.

## TC04 - Applicazione atomica e realtime

1. Con la stessa scheda aperta come DM e player, generare una preview applicabile.
2. Annotare PF massimi/correnti, Dadi Vita e pool risorse.
3. Confermare una sola volta.
4. Verificare nel browser DM e player l'aggiornamento realtime di livello, eventuale sottoclasse, PF, Dadi Vita e pool interessati.
5. Ricaricare entrambi i browser e verificare la persistenza.

## TC05 - Spellcasting, Pact Magic e risorse separate

1. Ripetere la preview su un caster Spellcasting e verificare soltanto la relativa progressione slot.
2. Ripetere su un Warlock e verificare soltanto Magia del Patto.
3. Su un PG con risorsa di classe verificare che rimanga un pool separato.
4. Dopo l'applicazione verificare che usi gia consumati e policy di recupero restino associati al pool corretto.

## TC06 - Conflitto e retry sicuro

1. Aprire una preview DM valida.
2. Prima della conferma modificare la scheda o applicare una progressione da un'altra sessione DM.
3. Confermare la preview obsoleta e verificare il messaggio di conflitto e il refresh allo stato corrente.
4. Verificare che non esistano PF, Dadi Vita, pool o livelli applicati parzialmente.
5. In caso di esito di rete ambiguo, riprovare la stessa conferma e verificare che il medesimo `requestId` restituisca la receipt senza un secondo level-up.

## TC07 - Limiti e stati non supportati

1. Verificare che livello totale 20 sia bloccato.
2. Verificare che PNG, progressioni legacy/incomplete e classi non censite non possano essere applicati come level-up automatico.
3. Verificare che la UI esponga il motivo e non proponga modifiche grezze come alternativa.

## TC08 - Storico e restart

1. Dopo un level-up riuscito riavviare l'app locale.
2. Verificare che livello, sottoclasse, PF, Dadi Vita e risorse siano invariati.
3. Verificare tecnicamente una singola receipt `CharacterLevelHistory` con revisioni prima/dopo, attore, classe, eventuale sottoclasse e dati PF del livello.
