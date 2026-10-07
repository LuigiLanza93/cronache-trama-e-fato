# Workspace Codex

Checkpoint applicativo corrente: [creazione e diario delle scelte](rules-inventory/implementation-step-two.md),
2026-10-02. Le verifiche del runtime e del database locale sono registrate lì;
il level up con tutte le scelte 2–20 rimane il lavoro successivo.

Le regole comuni sono in [AGENTS.md](../AGENTS.md); i default tecnici in
`.codex/config.toml` e i sette specialisti in `.codex/agents/*.toml`.
Modello e ragionamento dei ruoli sono definiti soltanto nei TOML.
Il modello principale resta una preferenza personale.
La [scelta dei modelli](codex-model-routing.md) documenta motivazioni e limiti
dell'aggiornamento; i valori effettivi restano nei TOML.

## Setup

1. Aprire la radice, leggere AGENTS.md e controllare `git status --short --branch`.
2. Consultare stato e lavoro aperto in codex-readme.md, se presente. Le note e
   codex-history.md sono ignorati da Git; lo storico non prova lo stato attuale.
   In un clone nuovo usare Git, README, roadmap e runbook pertinenti.
3. Verificare Node 22.x e package.json. In PowerShell usare gli shim .cmd;
   installare con `npm.cmd ci` se mancano le dipendenze.
4. Preparare prisma/migration.db tramite la procedura della feature, senza
   import automatici di JSON legacy o database di altri ambienti.
5. Avviare Express/Vite con `npm.cmd run dev`.

Per riprendere il lavoro applicativo della chat al checkpoint 2026-10-01, leggere [stato della creazione guidata](character-creation-level-one.md), [audit del modello comune](character-creation-progression-model-audit.md) e [roadmap M8](multiclass-roadmap.md). Il censimento delle regole di tutte le razze/classi precede nuove scelte puntuali. Le note distinguono feature implementate localmente, collaudo parziale e modello generale ancora da progettare; non sono prova del caricamento su Railway.

Per verifiche e Git vedere AGENTS.md; per produzione consultare le
[procedure Railway](railway-operations.md) e il piano della release.

## Configurazione e diagnostica

La configurazione personale è in ~/.codex/config.toml. Quella di progetto
richiede un repository attendibile: limitare il trust ai repository necessari,
evitando radici di dischi e directory contenitore troppo ampie.
Gli agenti sono scoperti da .codex/agents/: non duplicarne le definizioni.
I pin dei ruoli prevalgono sui default; il limite riguarda thread subagent
aperti, escluso il primario. La profondità uno resta anche una policy in AGENTS.md.

```powershell
codex --version
codex doctor --summary
codex doctor --help
```

Auth/rete vanno interpretate rispetto alla shell: la sandbox può usare un
account diverso dall'IDE. Non leggere o riportare file auth, token o segreti.
Dopo modifiche TOML aprire una nuova sessione e verificare caricamento, ruoli e
limiti: quella già aperta può conservare impostazioni precedenti. Doctor non
certifica tutti i comportamenti degli agenti.

Riferimenti: [config](https://learn.chatgpt.com/docs/config-file/config-reference),
[subagent](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
L'[audit settembre](codex-workspace-audit-2026-09.md) è storico;
l'[audit ottobre](codex-configuration-audit.md) documenta la semplificazione.
