# Initiative Player Tracker

## Obiettivo

Mostrare nella scheda personaggio un tracker iniziativa compatto, separato dalla chat col master, visibile solo quando il personaggio partecipa a un combattimento globale attivo.

## Regole funzionali

- Esiste un solo combattimento globale alla volta.
- Un personaggio vede il tracker solo se e solo se e inserito esplicitamente tra i partecipanti.
- Il tracker lato player compare come floating button separato dalla chat.
- Il tracker compare solo quando il combattimento e `started`.
- Se il DM preme `stop`, il combattimento termina e il tracker sparisce.
- Il tracker si apre chiuso.
- Su cambio turno compare un pallino notifica senza numero.
- La notifica si spegne quando il pannello viene aperto.

## Rivelazione informazioni

- Durante il round 1 si vedono solo i combattenti gia rivelati.
- Al primo turno del round 1 si vede solo il primo combattente della lista.
- Un combattente viene rivelato quando il suo turno arriva.
- Una volta rivelato, resta noto fino alla fine del combattimento.
- I combattenti non ancora rivelati non compaiono nella lista.
- Dal round 2 la sequenza e interamente nota, perche tutti i combattenti sono gia stati rivelati entro la fine del round 1.

## Informazioni mostrate per entry

Ogni entry rivelata mostra:

- nome
- eventuali status se presenti
- evidenziazione del turno corrente
- colore del nome in base ai PF correnti

Non vengono mostrati numeri o percentuali dei PF.

## Colori PF

- `> 50%`: verde
- `<= 50%`: arancione
- `<= 25%`: rosso
- `0%`: nero

I combattenti a `0 PF` restano visibili in lista.

## Nomi multipli

- Mostri duplicati usano nomi distinti tipo `Goblin 1`, `Goblin 2`.

## Realtime e persistenza

- Il player deve ricevere subito lo stato corretto entrando a combattimento gia avviato.
- Un refresh della pagina deve mantenere round, turno corrente e rivelazioni gia avvenute.
- Lo stato condiviso del combattimento deve quindi includere almeno:
  - partecipanti
  - `started`
  - `round`
  - `currentTurnId`
  - `revealedCombatantIds`
  - status
  - PF correnti o loro derivato visivo

## Note implementative

- Il DM continua a gestire l'incontro dalla pagina iniziativa.
- La scheda personaggio consuma una vista filtrata server-side, cosi i combattenti non rivelati non vengono esposti al client player.
- Il bottone iniziativa convive con il bottone chat come floating action separata.
