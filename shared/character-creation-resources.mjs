/** Verified level-one usage pools; acquisition is separate from spending/reset. */
export function resolveCreationResourcePools(materialized, context = {}) {
  const features = new Set((materialized.features ?? []).map(f => f.key));
  const abilities = context.abilities ?? materialized.abilities?.final;
  const mod = key => Math.floor(((abilities?.[key] ?? 10) - 10) / 2);
  const level = context.classLevels?.[materialized.identity?.classKey] ?? 1;
  const pools = [];
  const add = (featureId, label, maximum, resetPolicy, line, classSource = true) => {
    if (!features.has(featureId)) return;
    pools.push({ poolKey: `creation:${featureId}`, featureId, kind: 'CLASS_RESOURCE', label,
      resetPolicy, maximum: { '0': maximum }, used: { '0': 0 },
      sourceClassKey: classSource ? materialized.identity.classKey : null,
      source: { book: 'PHB-2014-it', path: 'docs/Manuale_del_Giocatore_5.0.md', line },
    });
  };
  add('rage', level >= 20 ? 'Ira · usi illimitati' : 'Ira', level >= 20 ? 0 : level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2, level >= 20 ? 'NONE' : 'LONG_REST', 1612);
  const bardDie = level >= 15 ? 12 : level >= 10 ? 10 : level >= 5 ? 8 : 6;
  add('bardic-inspiration', `Ispirazione Bardica · d${bardDie}`, Math.max(1, mod('charisma')), level >= 5 ? 'SHORT_REST' : 'LONG_REST', 1898);
  add('second-wind', 'Recuperare Energie', 1, 'SHORT_REST', 2993);
  add('divine-sense', 'Percezione del Divino', Math.max(0, 1 + mod('charisma')), 'LONG_REST', 4386);
  add('lay-on-hands', 'Imposizione delle Mani · punti', 5 * level, 'LONG_REST', 4391);
  // PHB says once per day, not once per long rest. Reset is assisted by the DM.
  add('arcane-recovery', 'Recupero Arcano · una volta al giorno', 1, 'MANUAL', 3645);
  add('warding-flare', 'Bagliore Protettivo', Math.max(1, mod('wisdom')), 'LONG_REST', 2361);
  add('wrath-of-the-storm', 'Collera della Tempesta', Math.max(1, mod('wisdom')), 'LONG_REST', 2451);
  add('war-priest', 'Sacerdote di Guerra', Math.max(1, mod('wisdom')), 'LONG_REST', 2265);
  add('fey-presence', 'Presenza Fatata', 1, 'SHORT_REST', 5539);
  add('tides-of-chaos', 'Onde del Caos', 1, 'LONG_REST', 5242);
  add('breath-weapon', 'Arma a Soffio', 1, 'SHORT_REST', 1189, false);
  add('relentless-endurance', 'Tenacia Implacabile', 1, 'LONG_REST', 1413, false);
  add('feat:lucky', 'Fortunato · punti fortuna', 3, 'LONG_REST', 8219, false);
  add('feat:martialAdept', 'Adepto Marziale · d6 superiorità', 1, 'SHORT_REST', 8090, false);
  add('feat:magicInitiate', 'Iniziato alla Magia · incantesimo di 1°', 1, 'LONG_REST', 8261, false);
  return pools;
}

/** Recompute only already acquired pools; do not invent new level-up decisions. */
export function reconcileCreationResourcePools(pools, materialized, context = {}) {
  if (!materialized?.identity || !Array.isArray(pools)) return pools;
  const definitions = new Map(resolveCreationResourcePools(materialized, context).map(pool => [pool.poolKey, pool]));
  return pools.map(pool => {
    const definition = definitions.get(pool.poolKey);
    if (!definition) return pool;
    const maximum = { ...definition.maximum };
    for (const tier of pool.tiers ?? []) {
      if (tier.maximumOverride != null) maximum[tier.tierKey] = Number(tier.maximumOverride);
    }
    return { ...pool, label: definition.label, resetPolicy: definition.resetPolicy, maximum,
      // Changing a capacity never restores spent uses. Explicit overrides remain authoritative.
      tiers: Array.isArray(pool.tiers) ? pool.tiers.map(tier => ({ ...tier,
        derivedMaximum: definition.maximum[tier.tierKey] ?? tier.derivedMaximum,
      })) : pool.tiers,
    };
  });
}
