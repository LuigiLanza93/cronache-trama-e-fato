# Progressione personaggio M5/M6: PF, Dadi Vita e risorse

Stato: sviluppo locale su `dev`. Le migrazioni sono additive e non sono state applicate a Railway.

## Decisioni di dominio

- Ruleset base: SRD 5.1/2014; le house rule gia confermate hanno precedenza.
- Ogni nuovo livello ottiene PF pari al Dado Vita pieno della classe incrementata piu il modificatore di Costituzione, con minimo 1. Il metodo persistito e `HOUSE_RULE_MAX` e la policy e `rest-v1`.
- I PF legacy correnti e massimi restano valori effettivi. Se lo storico per livello non e ricostruibile, il backfill usa `LEGACY_MANUAL` e non ricalcola il passato. Dopo il backfill, un cambio del modificatore di Costituzione applica comunque il delta deterministico `variazione modificatore × livello totale` ai PF massimi e correnti e registra una rettifica.
- I Dadi Vita sono pool distinti `d6`, `d8`, `d10`, `d12`. Il riposo breve automatico usa al massimo meta dei dadi massimi, minimo uno quando disponibili, e consuma in ordine `d12 > d10 > d8 > d6` fino a coprire i PF mancanti.
- Il riposo lungo ripristina integralmente tutti i pool Dadi Vita, oltre alla policy gia esistente su PF, PF temporanei, tiri salvezza morte e contatore dei riposi brevi.
- `SPELLCASTING`, `PACT_MAGIC`, `CLASS_RESOURCE` e `MANUAL` sono pool distinti. Il massimo e separato dallo stato consumato; il recupero dipende da `resetPolicy`, mai dal nome tradotto della classe.
- La conversione house rule degli slot puo modificare soltanto un pool `SPELLCASTING`.

## Persistenza M5

`CharacterHitPointState` conserva lo stato effettivo dei PF e del riposo. `CharacterHitDiePool` conserva massimo e residuo per taglia. `CharacterHitPointAdjustment` registra baseline e future rettifiche esplicite, incluse quelle per variazione della Costituzione.

I campi M5 gia riservati in `CharacterLevelHistory` diventano obbligatori come blocco per i nuovi level-up: taglia del dado, metodo, PF ottenuti e modificatore di Costituzione sono o tutti valorizzati oppure tutti null per le receipt M4 precedenti.

## Persistenza M6

`CharacterResourcePool` identifica il pool, la provenienza, la policy di reset e lo stato del backfill. `CharacterResourcePoolSource` collega una o piu classi/sottoclassi al pool. `CharacterResourcePoolTier` conserva per ogni livello o taglia il massimo derivato, l'eventuale override e la quantita usata.

Questa forma permette in futuro uno Spellcasting condiviso da piu classi e Pact Magic parallela senza cambiare lo schema dello stato consumato.

## Compatibilita e backfill

Gli script M5/M6 hanno dry-run predefinito e applicazione esplicita. Rifiutano schemi parziali, usano una transazione immediata, verificano integrita e nuove violazioni FK e sono rieseguibili senza sovrascrivere stato gia modificato.

Le proiezioni legacy in `Character.data.combatStats` restano disponibili durante la transizione, ma le mutazioni autorevoli aggiornano tabelle normalizzate e proiezioni nello stesso confine transazionale. Slot o risorse ambigui vengono conservati come `LEGACY_MANUAL`, senza resize o truncamento.

I level-up M4 locali gia applicati ad Aros e Narak non hanno dati PF/Dadi Vita nelle receipt. Il backfill M5 assorbe i valori effettivi correnti e li marca legacy/manuali; non inventa retroattivamente guadagni PF.

## Produzione

Nessuna operazione su Railway e autorizzata da questo sviluppo. Il rilascio futuro deve impedire writer concorrenti durante l'intero cambio di autorita dei dati:

1. attivare la modalita di manutenzione o fermare i writer prima dell'analisi/backfill M5;
2. creare e verificare un backup fresco;
3. applicare in ordine M3 e backfill, M4, M5 e M6 mantenendo il blocco scritture;
4. distribuire l'esatto `main` che usa M5/M6 come fonte autorevole, senza riaprire prima il servizio precedente;
5. eseguire `integrity_check`, `foreign_key_check` e smoke test autenticati;
6. riaprire i writer soltanto dopo esito positivo.

In caso di errore il servizio resta in manutenzione e il rollback usa il backup verificato insieme al precedente artefatto applicativo. Non usare `prisma db push` in produzione.
