# Progressione personaggio M3

Stato: completato, verificato e consolidato su `dev` il 2026-09-07; applicato soltanto al database locale di sviluppo. Non applicato a Railway.

## Scopo

M3 introduce il modello persistito delle classi senza cambiare il comportamento visibile dell'applicazione. Le regole canoniche restano versionate in `shared/character-class-rules.mjs`; il database conserva catalogo e snapshot assegnati ai personaggi per rendere le future progressioni verificabili e riproducibili.

Le nuove tabelle sono `ClassRule`, `SubclassRule`, `CharacterProgression` e `CharacterClass`. Durante M3 ogni personaggio puo avere al massimo una riga `CharacterClass`; indici e trigger impediscono duplicati, piu classi primarie, sottoclassi della classe sbagliata e disallineamento tra `classKey` e `ClassRule`.

## Compatibilita applicativa

Il server esegue un dual-read interno conservativo:

- schema assente: usa il modello legacy;
- schema parziale o privo di un vincolo richiesto: usa il modello legacy e produce diagnostica interna;
- schema completo e backfill coerente: accetta la progressione strutturata come shadow interno;
- snapshot legacy modificato dopo il backfill, divergenze o righe ambigue: torna al legacy.

REST, Socket.IO e UI non espongono ancora `classes[]` o `totalLevel`. Anche il writer di classe/livello resta legacy in M3; M4 introdurra il comando di progressione autorevole e blocchera la modifica diretta dei vecchi campi.

## Procedura locale

```powershell
npm.cmd run progression:m3:dry-run
npm.cmd run progression:m3:apply-local
```

Lo script `scripts/apply-character-progression-m3.mjs` verifica integrita e foreign key, applica la migrazione in una transazione, sincronizza il catalogo dal codice e registra le divergenze senza correggerle. La riesecuzione non duplica righe e non incrementa revisioni quando nulla e cambiato.

L'uscita `0` indica una migrazione coerente senza casi irrisolti. L'uscita `2` indica invece che schema, catalogo e diagnostica sono stati applicati e committati, ma uno o piu personaggi sono rimasti `UNRESOLVED`: non equivale a un rollback e richiede revisione manuale prima di proseguire. L'uscita `1` indica un errore che impedisce il completamento della transazione.

Esito locale del 2026-08-15: 12 classi, 14 sottoclassi, 6 personaggi backfilled, 0 irrisolti. Una copia pre-M3 recuperabile e conservata localmente sotto `.backups/local/`, fuori da Git.

La verifica del 2026-09-07 ha confermato build, 148/148 test P1/Gate, Prisma validate, TypeScript Vite, sintassi dello script e dry-run M3 con 6/6 personaggi risolti e zero scritture. Il type-check applicativo globale resta rosso per errori in moduli frontend esterni al diff M2/M3; non modifica le garanzie della migrazione, ma rimane un debito tecnico da chiudere prima di ampliare M4.

L'importatore storico `scripts/import-json-to-sqlite.mjs` e ora disabilitato per default e rifiuta sempre database che contengono anche una sola tabella M3, per evitare cancellazioni della nuova struttura.

## Produzione

Nessuna operazione viene eseguita automaticamente all'avvio. Per Railway servono autorizzazione esplicita di rilascio, backup fresco verificato, applicazione controllata dello script a `/data/migration.db`, conteggi pre/post, `integrity_check`, `foreign_key_check` e smoke test DM/player. Non usare `prisma db push` e non usare mai il DB locale per sovrascrivere Railway.

Il rollback applicativo e immediato finche M4 non e attivo: il server continua a funzionare sul legacy. Un eventuale rollback dello schema o dei dati di produzione resta manuale e deve partire dal backup pre-migrazione.
