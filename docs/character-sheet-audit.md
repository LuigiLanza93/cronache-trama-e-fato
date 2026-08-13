# Audit completo della scheda personaggio

Stato: **analisi completata; pacchetti P0 e P1 implementati tecnicamente il 2026-08-12; P1 in attesa di test manuale utente**.
Branch analizzato: `dev`.
Perimetro: comportamento applicativo, persistenza, autorizzazioni, realtime, UI e copertura delle regole dichiarate dalla scheda.

## Esito esecutivo

La scheda e utilizzabile nei casi correnti, ma non e ancora una base affidabile per il wizard di creazione o il level-up. L'audit ha trovato rischi immediati di integrita dei dati e correttezza:

1. l'apertura della scheda puo ricalcolare e salvare automaticamente PF massimi, PF correnti, Dadi Vita e slot;
2. due patch Socket.IO ravvicinate possono perdere la prima modifica;
3. un riposo DM puo essere sovrascritto da una patch pendente;
4. il lifecycle delle stanze realtime puo mostrare lo stato di un altro personaggio e il payload patch e applicato in modo errato;
5. un Socket gia autenticato resta autorizzato dopo logout o revoca della sessione;
6. mancano validazione server del documento scheda, conferma di persistenza e revisioni concorrenti.

Prima della 1.8 e consigliato completare un blocco di stabilizzazione dedicato. Multiclass, expertise, Pact Magic separata, condizioni e override espliciti sono invece requisiti strutturali da progettare per 1.9/1.10.

### Aggiornamento P0 del 2026-08-12

I sei problemi P0 descritti sotto sono stati corretti. Le mutazioni core sono serializzate per slug, versionate e confermate soltanto dopo il commit SQLite; anche i riposi multi-PG attraversano il coordinatore atomico. Il client non riscrive piu PF, Dadi Vita o slot all'apertura, lascia correttamente le room precedenti e applica soltanto payload canonici dello slug attivo. Logout, scadenza e revoca invalidano la sessione Socket e lo stato client correlato.

Sono stati chiusi anche due difetti realtime emersi durante il test manuale: inventario ed equipaggiamento ora emettono un'invalidazione autorizzata dopo commit e le viste aperte rifanno una lettura deduplicata; i TS morte vengono reidratati dallo stato persistito e sincronizzati con patch minime. I TS morte restano visibili nei riepiloghi DM/iniziativa soltanto a 0 PF e sono modificabili soltanto a 0 PF, con controllo sia UI sia server.

Verifiche completate: `node --check server.js`, `npx.cmd tsc --noEmit --pretty false`, `npm.cmd run test:p1`, `npm.cmd run build`, `git diff --check` e revisione quality/security senza finding significativi residui. I test manuali P0 concordati con l'utente sono positivi; per P1 e disponibile una suite automatica mirata di 86 casi, incluso il bootstrap server con `/healthz`, e resta da completare il collaudo browser autenticato/multi-client descritto in [`p1-manual-test-plan.md`](./p1-manual-test-plan.md).

## Metodo e limiti

Sono stati eseguiti:

- censimento di pagina, card e componenti;
- tracciamento UI -> Socket/API -> server -> SQLite -> reload/realtime;
- confronto fra `Character.data`, colonne `Character` e tabelle normalizzate;
- revisione statica di autorizzazioni, calcoli, riposi, inventario e valuta;
- ispezione read-only del DB locale di sviluppo: 4 personaggi attivi, tutti con schema JSON non uniforme; 61 `CharacterItem` normalizzati;
- build di produzione e lint mirato.

Non sono stati eseguiti test browser end-to-end o chiamate API autenticate con account reali per P1. Il repository contiene ora una suite Vitest mirata a regole, validazione patch, riposi e migrazione/backfill; i casi multi-client, autorizzazione con sessioni reali, responsive e accessibilita restano nella baseline manuale sotto.

Per il confronto regolistico si assume come riferimento attuale **SRD 5.1 / regole 2014**, coerente con i cataloghi legacy esistenti. Se la campagna adotta regole 2024 o house rule, ogni divergenza va riclassificata esplicitamente. Riferimenti ufficiali:

- <https://www.dndbeyond.com/srd>
- <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf>

## Matrice delle sezioni

| Area | Stato app | Copertura regole | Sorgente principale | Valutazione |
| --- | --- | --- | --- | --- |
| Identita, tipo, ritratto | Parziale | Parziale | colonne `Character` + copia JSON | Campi base modificabili; owner/assegnazione reale non visibili nella scheda |
| Owner e autorizzazioni | Parziale | N/A | `Character.ownerUserId` | Accesso HTTP/Socket principale protetto; lifecycle sessione Socket incompleto |
| Caratteristiche e modificatori | Parziale | Parziale | `Character.data.abilityScores` + effetti passivi | Breakdown presente; mancano limiti, origine del valore e override esplicito |
| Bonus competenza e TS | Parziale | Parziale | livello + `proficiencies.savingThrows` | Formula single-class corretta; configurazione TS non disponibile qui |
| Abilita | Parziale | Mancante | `proficiencies.skills` JSON | Solo booleano competente; expertise e mezza competenza assenti |
| Classe, livello, sottoclasse, multiclass | Parziale | Mancante | colonne + `basicInfo` JSON | Una classe e un livello; sottoclasse e livelli per classe assenti |
| PF, PF temporanei, Dadi Vita | Affidabile nel core corrente | Incompleta per progressione | `combatStats` JSON | Nessuna riscrittura all'apertura; storico per livello e multiclass restano nel Gate 1.8A |
| TS contro morte | Corretto nel core corrente | Sufficiente | `combatStats.deathSaves` JSON + stato locale derivato | Reidratazione e realtime corretti; modifica ammessa soltanto a 0 PF |
| CA, iniziativa, velocita | Parziale | Parziale | derivati client + equip relazionale | Breakdown utile; override e formule alternative non espliciti; sensi assenti |
| Attacchi e armi | Parziale | Errata/incompleta | inventario relazionale + attacchi legacy | Proprietà/equip ricchi; competenza arma e danno off-hand errati |
| Inventario ed equip | Affidabile nel core corrente | Parziale | `CharacterItem` e tabelle collegate + JSON legacy | Mutazioni normalizzate e aggiornamento multi-client post-commit; carico e regole avanzate restano incompleti |
| Carico e peso | Mancante | Mancante | peso presente solo nell'anagrafica item | Nessuna somma, capacita o encumbrance |
| Valuta | Corretto nel core | Sufficiente | `CharacterCurrencyBalance` + ledger | Operazioni validate e tracciate; copie legacy restano nel JSON |
| Capacita e risorse | Parziale | Parziale | `capabilities` JSON + feature item | Usi e reset base presenti; encounter/custom non automatizzati |
| Riposi | Parziale | Errata/incompleta | logica server + `restState` JSON | Automazione coerente con la V1, non con tutte le regole SRD 5.1 |
| Incantesimi, CD e slot | Non affidabile | Parziale/mancante | features e slot JSON + tabella progressioni | Singola classe; slot riscritti; niente attacco incantesimo o pool separati |
| Pact Magic | Parziale | Mancante nel multiclass | stesso pool degli altri slot | Reset Warlock presente; pool non distinto da Spellcasting |
| Condizioni, resistenze, immunita, sensi | Mancante | Mancante | nessuna sorgente PG dedicata | Presenti per mostri, non per personaggi |
| Lingue | Parziale | Parziale | array JSON | Consultazione presente; modifica/competenze strumenti assenti |
| Tratti narrativi e backstory | Parziale | Parziale | JSON legacy + `CharacterBackstory` | Backstory normalizzata ma fuori dal flusso principale; tratti non strutturati |
| Override e precedenza | Mancante | Mancante | comportamenti impliciti nei componenti | Nessun contratto source -> derived -> override |
| Storico modifiche | Mancante | N/A | solo `updatedAt` | Valuta/inventario hanno ledger; core scheda, owner e avatar no |
| Responsive e accessibilita | Parziale | N/A | componenti React/Tailwind | Buona base, ma griglie strette, drag solo pointer e label incomplete |

## Mappa delle sorgenti e delle precedenze attuali

```text
Character (SQLite)
├─ colonne normalizzate
│  ├─ slug, name, characterType, ownerUserId
│  └─ className, race, alignment, background, level, portraitUrl
├─ data (JSON legacy/core)
│  ├─ abilityScores, combatStats, proficiencies
│  ├─ features, capabilities, pactBlade
│  └─ equipment legacy, coins legacy e copie di campi normalizzati
├─ CharacterCurrencyBalance + CurrencyTransaction
├─ CharacterItem + equip + feature state + InventoryTransaction
├─ CharacterBackstory
└─ file ritratto

lettura:
  parse Character.data
  -> colonne Character sovrascrivono identita/base
  -> valuta relazionale sovrascrive la proiezione di lettura
  -> inventario relazionale arriva con una seconda richiesta separata

scrittura core:
  patch Socket non validata
  -> deepMerge con snapshot letto da SQLite
  -> debounce 200 ms
  -> riscrittura dell'intero JSON e delle colonne duplicate
```

Evidenze centrali: `prisma/schema.prisma:324`, `server.js:1168`, `server.js:8273`, `server.js:8732`, `server.js:8982`, `server.js:11538`.

## Problemi P0 - integrita o sicurezza

**Stato complessivo:** risolti nel pacchetto P0 del 2026-08-12. Le descrizioni originali restano come memoria del rischio e motivazione delle soluzioni adottate.

### P0.1 - Aggiornamenti persi nel debounce realtime

**Impatto:** perdita silenziosa di modifiche dello stesso client o di DM/player concorrenti.

**Riproduzione:** inviare entro 200 ms due patch su rami diversi, per esempio PF correnti e features. Ogni evento rilegge il vecchio DB; il secondo cancella il timer del primo e salva uno snapshot che non contiene la prima patch.

**Evidenze:** `server.js:8982-8991`, `server.js:11538-11552`.

**Soluzione:** pipeline unica e seriale per slug, basata sull'ultima revisione in memoria o su una transazione immediata; revisione ottimistica e ack solo dopo commit.

### P0.2 - Riposo DM sovrascrivibile da patch pendente

**Impatto:** PF, slot, Dadi Vita e risorse appena aggiornati dal riposo possono tornare allo stato precedente.

**Riproduzione:** il player modifica un campo; prima dei 200 ms il DM applica il riposo; il timer precedente scatta dopo la scrittura del riposo.

**Evidenze:** `server.js:10993`, `server.js:8982-8991`.

**Soluzione:** tutte le mutazioni di `Character.data`, incluse quelle HTTP/server-side, devono attraversare lo stesso coordinatore versionato.

### P0.3 - Apertura scheda riscrive PF e Dadi Vita

**Impatto:** un valore valido manuale, tirato, medio o multiclass viene sovrascritto senza azione dell'utente; i PF correnti vengono troncati al nuovo massimo.

**Riproduzione:** guerriero livello 5, COS 14, PF massimi 44; aprire la scheda. Il client calcola `(10 + 2) * 5 = 60`, aggiorna lo stato e programma il salvataggio.

**Evidenze:** `src/components/characterSheet/hit-points.tsx:146-180`.

**Soluzione:** eliminare ogni scrittura da render/effect; introdurre ledger dei guadagni PF per livello, Dadi Vita per classe, formula derivata e override esplicito.

### P0.4 - Slot ridimensionati e troncati automaticamente

**Impatto:** slot custom, multiclass o Pact Magic possono sparire semplicemente aprendo la scheda o cambiando classe/livello. L'effetto non rispetta la sola lettura.

**Evidenze:** `src/components/characterSheet/features.tsx:53-97`.

**Soluzione:** calcolo puro in anteprima; ricalcolo soltanto tramite comando esplicito e modello con pool `spellcasting`, `pactMagic` e manuali separati.

### P0.5 - Room e payload realtime possono contaminare la scheda aperta

**Impatto:** un DM che visita A e poi B resta nella room A. Uno stato completo di A puo sostituire B; una successiva modifica puo essere inviata allo slug B partendo dai dati sbagliati. Inoltre il server emette `{slug, patch}`, mentre il client applica l'intero wrapper invece di `payload.patch`.

**Evidenze:** `src/pages/CharacterSheet.tsx:1649-1681`, `src/realtime.ts:143-169`, `server.js:11529-11552`.

**Soluzione:** `character:leave`, una sola room scheda attiva, payload sempre `{slug, revision, state|patch}`, filtro slug client e test con due schede/due browser.

### P0.6 - Socket ancora autorizzato dopo logout o revoca

**Impatto:** un vecchio Socket, incluso uno DM, puo continuare a inviare eventi dopo che la sessione HTTP e stata eliminata o revocata.

**Evidenze:** utente memorizzato alla connessione in `server.js:11511`; logout HTTP in `server.js:9252` senza disconnessione dei Socket associati.

**Soluzione:** legare il Socket al `sessionId`, disconnetterlo su logout/reset/eliminazione/scadenza e riconvalidare la sessione sugli eventi mutanti.

## Problemi P1 - correttezza centrale

**Stato complessivo:** implementato localmente il 2026-08-12. Le patch core hanno validazione server allowlist/tipi/range e risposta canonica; la scheda mostra lo stato di persistenza e si riconcilia dopo gli errori. Le armi censite distinguono gruppo semplice/marziale e proprieta leggera, il resolver applica la competenza della classe monoclasse corrente e tratta correttamente l'attacco bonus con due armi. I riposi seguono SRD 5.1 per scelta/tiro dei Dadi Vita, recupero lungo della meta e requisiti temporali; skill e percezione condividono un solo calcolo e il punteggio 0 resta 0. Restano fuori dal pacchetto i pool Dadi Vita multiclasse del Gate 1.8A e una garanzia di flush su chiusura brutale del browser; le mutazioni gia ricevute dal server sono sincrone/accodate e confermate post-commit.

| ID | Problema | Riproduzione/Impatto | Soluzione consigliata |
| --- | --- | --- | --- |
| P1.1 | Validazione server core — **risolto localmente 2026-08-12** | Patch invalide o campi server-owned vengono rifiutati prima del merge/commit | Conservare test negativi su tipi, range, path e prototype keys |
| P1.2 | ACK e feedback persistenza — **risolto nel flusso normale; hard-unload residuo** | ACK/revisioni post-commit e riconciliazione sono attivi; una chiusura brutale puo interrompere richieste client non ancora emesse | Aggiungere in futuro warning/flush REST se serve garanzia anche su hard close |
| P1.3 | TS morte non reidratati — **risolto 2026-08-12** | La UI deriva ora i contatori persistiti, sincronizza patch minime e impedisce modifiche sopra 0 PF | Conservare regressioni su refresh, due client, guarigione e riposo |
| P1.4 | Competenza armi — **risolto localmente 2026-08-13** | Gruppo arma, classe, effetti passivi `PROFICIENCY` e Arma del Patto determinano se aggiungere PB; il riepilogo mostra categorie, armi specifiche e provenienza senza generalizzare l'Arma del Patto | Migrare in futuro la provenienza verso regole sottoclasse/multiclasse normalizzate |
| P1.5 | Danno mano secondaria — **risolto localmente 2026-08-12** | La riga sinistra e azione bonus TWF solo con due armi leggere; il mod positivo richiede lo stile esplicito | Conservare test su light, stile, mod negativo e attacco normale |
| P1.6 | Riposi SRD 5.1 — **risolto localmente 2026-08-12** | Il DM sceglie dadi e totale naturale; niente limite di due brevi; il lungo recupera meta Dadi Vita e rispetta PF/24h | Separare i pool per classe nel Gate 1.8A |
| P1.7 | Percezione passiva — **risolto localmente 2026-08-12** | Skill e percezione usano lo stesso rank/contributo di competenza in ogni consumer | Aggiungere regressioni automatiche cross-view |
| P1.8 | Punteggio 0 — **risolto localmente 2026-08-12** | Lo zero resta finito e produce modificatore -5; editor/server accettano solo interi 0..30 | Conservare test 0, mancanti e non-finiti |

Evidenze: `src/pages/CharacterSheet.tsx:694-698`, `src/components/characterSheet/proficiencies.tsx:125-135`, `src/components/characterSheet/proficiencies.tsx:219-289`, `src/components/characterSheet/attacks-and-spells.tsx:410-479`, `src/lib/character-derived-stats.ts:286-306`, `src/utils.ts:188-197`, `server.js:8814-8890`.

## Problemi P2 - copertura incompleta

- **Skill:** expertise e mezza competenza assenti; il salvataggio ricostruisce le skill come booleano competente e non puo preservare un futuro rank.
- **Classi:** nessun `classLevels[]`, sottoclasse, prerequisito multiclass o Dado Vita per classe.
- **Derivati:** CA, iniziativa e velocita hanno buoni breakdown, ma non un override manuale dichiarato ne formule alternative come difese senza armatura.
- **Incantesimi:** manca l'attacco incantesimo; caratteristica non sovrascrivibile; conosciuti/preparati non distinti; Pact Magic condivide il pool standard.
- **Stati di combattimento:** condizioni, vulnerabilita, resistenze, immunita e sensi del PG non sono modellati.
- **Inventario:** il peso dell'item esiste, ma non carico, capacita o encumbrance; il relazionale non si aggiorna fra viewer senza refresh.
- **Competenze narrative:** lingue read-only nella scheda; strumenti non modellati come competenze.
- **Risorse:** encounter e custom non hanno automazione; alcune risorse non-spell sono inserite nello stesso modello degli slot.
- **Storico:** manca un audit log per core scheda, assegnazioni e avatar.
- **Sola lettura:** alcune azioni inventario/attacchi/slot restano visivamente disponibili durante il lock, anche se parte delle scritture viene poi scartata o rifiutata.

## Problemi P3 - UX e debito tecnico

- calcoli di PB, percezione, CD, CA e iniziativa duplicati in scheda, dashboard e tracker, con supporto diverso agli effetti passivi;
- `CharacterSheet.tsx` e i componenti della scheda usano molti `any`: il lint mirato rileva 156 errori e 11 warning;
- errori di rete/500 sul caricamento diventano “personaggio non esiste”; i cataloghi falliti appaiono come liste vuote;
- griglie fisse a 3/6 colonne e padding pagina di 24 px sono fragili a 320-390 px;
- riordino card soltanto tramite pointer, senza sensore tastiera;
- alcuni slot/button non hanno nome accessibile e diverse label non sono associate al controllo;
- stati vuoti non uniformi, in particolare per lingue e sezioni di contenuto.

## Controlli positivi verificati

- lista e dettaglio personaggi sono filtrati per ownership;
- join e update Socket verificano ownership e lock sessione;
- inventario, valuta e avatar verificano ownership; delete scheda e write backstory sono DM-only;
- ownership canonica deriva da `Character.ownerUserId`, non dal JSON client;
- valuta e inventario relazionale hanno ledger e operazioni dedicate;
- la build di produzione passa.

## Suite minima di regressione

1. **Persistenza concorrente:** due patch su rami diversi entro 200 ms, stesso socket e due socket; entrambe presenti dopo ack, refresh e restart.
2. **Conflitto riposo:** patch player concorrente a preview/apply DM; nessun valore del riposo deve regredire.
3. **Sessione Socket:** logout, reset password, eliminazione/scadenza sessione; ogni vecchio Socket deve perdere lettura e scrittura.
4. **Room lifecycle:** DM apre A, poi B; aggiornamenti di A non devono toccare B; payload con slug errato ignorato.
5. **PF:** classi d6/d8/d10/d12, livelli 1/5/20, COS negativa/positiva, media/tiro/manuale, cambio COS, multiclass e PF correnti sopra il nuovo massimo.
6. **TS morte:** 0-3 successi/fallimenti, refresh, due client, guarigione da 0 e riposo.
7. **Skill:** modificatore negativo, none/half/proficient/expertise, bonus passivo e percezione coerente fra scheda/dashboard/tracker.
8. **Attacchi:** arma competente/non competente, Accurate FOR/DES, off-hand con/senza stile, versatile, ranged/thrown e bonus passivi.
9. **CA:** nessuna armatura, leggera/media/pesante, DES negativa/alta, scudo, doppio scudo, formula alternativa e override.
10. **Slot:** caster single-class, Warlock livelli chiave, short rest, multiclass Warlock+caster con pool distinti; cambio livello non cancella usi validi.
11. **Riposi/risorse:** scelta 0/1/N Dadi Vita, COS negativa, recupero lungo, short/long/daily/custom e risorse item.
12. **Inventario realtime:** assegna/equipaggia/consuma/trasferisce da un client; il secondo viewer si aggiorna o invalida e rifetcha.
13. **Autorizzazioni dirette:** player non owner su GET, Socket join/update, inventario, valuta, avatar e backstory; sessione chiusa su ogni mutazione.
14. **Responsive/a11y:** viewport 320/360/390/768/desktop, zoom 200%, sola tastiera, focus dialog, drag card e nomi accessibili.

## Fix richiesti prima della 1.8

Ordine consigliato:

1. pipeline di persistenza unica, versionata e con ack; eliminazione del lost update e del conflitto con i riposi;
2. lifecycle room/payload realtime corretto e revoca effettiva dei Socket alla fine sessione;
3. rimozione delle scritture automatiche di PF/Dadi Vita e slot all'apertura;
4. idratazione TS morte e mutazioni uniformemente bloccate in sola lettura;
5. competenza armi e danno off-hand corretti;
6. test automatici per i punti 1-5 prima di ulteriori automazioni.

Questi fix sono candidati a una patch di stabilizzazione 1.7.x o a un prerequisito tecnico pre-1.8. Non richiedono ancora il modello completo di creazione/level-up, ma devono evitare nuove scritture nel blob legacy.

## Requisiti riusabili per 1.9 e 1.10

- contratto tipizzato condiviso e validato server-side;
- modello esplicito `valore sorgente -> formula derivata -> override -> valore effettivo`, con breakdown;
- `classLevels[]`, sottoclasse e ledger dei Dadi Vita/PF per livello;
- rank competenza `none | half | proficient | expertise` e competenze armi/armature/strumenti;
- pool slot distinti (`spellcasting`, `pactMagic`, custom) e risorse tipizzate;
- anteprima differenziale senza scritture, conferma atomica e revisione attesa;
- provenienza/licenza/versione di ogni regola automatizzata;
- storico minimo delle operazioni di creazione e level-up;
- nuove strutture in tabelle/campi dedicati, non in `Character.data`.

## Decisioni prodotto ancora necessarie

1. Confermare SRD 5.1/2014 come regole di riferimento oppure censire formalmente house rule e regole 2024.
2. Confermare se la creazione diretta di un PG da parte di qualsiasi player autenticato e voluta.
3. Decidere se l'owner puo modificare un PG “In preparazione” nella futura 1.8.
4. Decidere quali override il player puo impostare senza approvazione DM.
5. Stabilire la granularita dello storico: tutte le patch, solo campi critici o snapshot delle operazioni guidate.

## Verifiche tecniche eseguite

- `npm.cmd run build`: **passato**; warning chunk principale oltre 500 kB e Browserslist obsoleto.
- lint mirato sulla scheda: **non passato**, 167 problemi (156 errori, 11 warning), in maggioranza `no-explicit-any` e dipendenze Hook.
- ispezione DB locale: **sola lettura**, nessuna modifica a `prisma/migration.db`.
- regressioni automatiche P1: **86 test passati** su regole derivate/combattimento, riepilogo competenze, competenze passive e Arma del Patto, validazione patch server, riposi, bootstrap/health e migrazione/backfill armi;
- API/browser/realtime multi-client: **test manuali concordati positivi** sul pacchetto P0 e sui difetti realtime segnalati; il collaudo P1 autenticato resta da eseguire con la checklist dedicata.
