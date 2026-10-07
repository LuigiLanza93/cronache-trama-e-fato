# Scelta dei modelli degli agenti

Aggiornamento del 2026-10-01 richiesto dall'utente. I valori effettivi sono nei
TOML, non in questo documento: questa è la motivazione della scelta iniziale.

Sol 6.1 è il default degli agenti generici con effort medium e il modello dei
sei specialisti di implementazione, revisione e release. Il frontend parte da
medium; backend, database, regole RPG, review e release usano high per contratti,
interazioni tra regole, concorrenza o rischio sui dati. Luna 6 è assegnato alla
sola finalizzazione Git, con effort low, scope esatto e verifiche obbligatorie.
Effort più alti non sostituiscono test, review o autorizzazioni.

La [guida ufficiale alla scelta](https://learn.chatgpt.com/docs/model-selection)
indica Luna per compiti delimitati e ripetibili e Sol 6.1 per lavoro tecnico
complesso. Queste assegnazioni sono scelte progettuali, non benchmark del repo.

Le [tariffe Codex/Work](https://learn.chatgpt.com/docs/pricing) alla data
dell'aggiornamento, a velocità Standard, indicano crediti per milione di token:

| Modello | Input | Input cached | Output |
| --- | ---: | ---: | ---: |
| Sol 6.1 | 50 | 2,5 | 250 |
| Luna 6 | 2,5 | 0,25 | 12,5 |

Il vantaggio nominale Luna è 20x su input/output e 10x sulla cache. Il risparmio
per incarico dipende da token, reasoning, retry e qualità; le tariffe in crediti
non stimano automaticamente l'uso incluso in Plus. Non usare prezzi API per
dedurre il numero di incarichi inclusi. Nessun benchmark comparativo sul progetto
è stato eseguito e nessuna modifica alla fatturazione è stata effettuata.

Il catalogo bundled della CLI 0.159.2 contiene entrambi gli slug e gli effort
scelti. Non è prova dell'accesso effettivo dell'account o della qualità runtime.
I pin dei ruoli prevalgono sul default generico: aumentare l'effort nello spawn
non sostituisce necessariamente un pin del ruolo. Per un incarico eccezionale
scegliere esplicitamente un agente generico con scope/istruzioni adeguati oppure
aggiornare il pin; non introdurre escalation automatiche o retry indefiniti.

Aprire una nuova sessione per caricare i cambi. Se Luna fallisce nella
finalizzazione, riportare il problema al root prima di nuove operazioni Git;
valutare Sol low senza ampliare il perimetro autorizzato.
