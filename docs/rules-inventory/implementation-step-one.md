# Primo incremento eseguibile: catalogo e motore condiviso

Checkpoint locale su `dev`, **2026-10-01**, non committato.

## Disponibile

- `shared/phb-spell-catalog.json`: 361 magie con ID stabili, descrizioni estese,
  fonte nel Markdown (righe/pagina), liste complete delle otto classi e alias.
  Il generatore `scripts/build-phb-spell-catalog.mjs --check` verifica che il
  file sia riproducibile dalla fonte. I JSON legacy non sono fonte normativa.
- Le opzioni iniziali 0–1 coincidono con le liste del manuale: nessuna voce
  mancante o fuori lista nelle otto classi. Paladino e Ranger iniziano a
  lanciare incantesimi al livello di classe 2, senza scelte magiche iniziali.
- Wizard e magie originate dalla creazione consultano i dettagli del nuovo
  catalogo; nella scheda resta il raggruppamento per livello. Nomi storici e
  voci manuali restano compatibili, senza riscrivere gli snapshot.
- `shared/character-rule-engine.mjs`: formule e condizioni dichiarative,
  cardinalità, appartenenza alle opzioni, unicità, dipendenze, attivazione
  dell'evento e concessioni con provenienza. Non esegue codice nelle formule.
  Una scelta invalida impedisce l'emissione delle concessioni dell'evento.
- La creazione usa il validator comune; i primi eventi dichiarativi concedono
  Druidico al Druido e Draconico alla Stirpe Draconica. Druidico non compare
  nelle lingue liberamente selezionabili.
- Bardo: strumento posseduto scelto separatamente dalle tre competenze.
  Ladro: expertise disponibile anche sulle abilità ottenute da talento e
  scelte alternative reali. Mago: preparazione limitata al libro valido;
  alias conservati e duplicati verificati per identità canonica.
- I retry di richieste già completate verificano la firma storica prima
  delle nuove regole: una nuova scelta obbligatoria non invalida la ricevuta.
  Creatore, payload e autorizzazione attuale restano verificati; dopo una
  riassegnazione il vecchio proprietario non riceve lo snapshot corrente.

## Perimetro ancora aperto

Questo è un primo adattatore del contratto, non il level up completo.
Restano definizioni eseguibili di tutti gli eventi 2–20, varianti, sostituzioni,
preparazione dopo riposo, copie nel libro e persistenza/API delle nuove decisioni.
Non sono state introdotte nuove tabelle o migrazioni in questo incremento;
gli eventi iniziali sono proiettati nello snapshot di creazione esistente.
Nessuna ricostruzione automatica delle scelte dei PG legacy.

Due metadati OCR restano esplicitamente incerti: scuola di Illusione Minore
e scuola/ordinale della descrizione di Resurrezione (livello 7 verificato nelle
liste). Il catalogo conserva warning e valori sconosciuti; nessuna regola
basata sulla scuola viene dedotta per queste righe.

## Verifiche

- P1: **26 file, 245 test superati**, incluse HTTP su DB temporaneo, replay
  storico, ownership, input falsificati, alias e rigenerazione del catalogo.
- Build, TypeScript app e configurazione, sintassi server: superati.
- Generatore `--check` e audit liste 0–1: superati; due warning OCR espliciti.
- Diff check: superato. Nessuna nuova modifica dello schema Prisma; validate
  non rieseguito per questo incremento. Browser e produzione non verificati.
- Build con warning Browserslist preesistente e chunk oltre 500 kB, incluso
  il catalogo descrittivo condiviso (circa 578 kB, 130 kB gzip).

## Collaudo manuale mirato

1. Bardo: scegliere tre strumenti di competenza e un diverso strumento
   iniziale; controllare competenze e inventario separatamente.
2. Druido e Stregone draconico: controllare le lingue automatiche; la magia
   selvaggia non deve concedere Draconico.
3. Warlock: verificare i nomi italiani, tutte le opzioni base corrette e
   l'espansione del patrono; il patrono non concede Vigore Immondo.
4. Mago: scegliere libro e preparazione, leggere descrizioni e verificare
   il raggruppamento per livello nella scheda, anche su PG creati prima.
5. Riprendere il piano completo prima di dichiarare copertura di livello 1
   e poi collegare gli eventi alla persistenza della progressione.
