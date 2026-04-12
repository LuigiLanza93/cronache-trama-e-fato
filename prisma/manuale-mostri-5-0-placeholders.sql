BEGIN TRANSACTION;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYWFyYWtvY3JhLmpzb24', 'mm5-aarakocra', 'Aarakocra', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-aarakocra.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-aarakocra",
  "general": {
    "name": "Aarakocra",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.489Z', '2026-04-12T13:32:40.489Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYWFyYWtvY3JhLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.489Z', '2026-04-12T13:32:40.489Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYXJ0aWdsaW8tc3RyaXNjaWFudGUuanNvbg', 'mm5-artiglio-strisciante', 'Artiglio Strisciante', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-artiglio-strisciante.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-artiglio-strisciante",
  "general": {
    "name": "Artiglio Strisciante",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYXJ0aWdsaW8tc3RyaXNjaWFudGUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmFuc2hlZS5qc29u', 'mm5-banshee', 'Banshee', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-banshee.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-banshee",
  "general": {
    "name": "Banshee",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmFuc2hlZS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmVob2xkZXIuanNvbg', 'mm5-beholder', 'Beholder', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-beholder.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-beholder",
  "general": {
    "name": "Beholder",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmVob2xkZXIuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmVzdGlhLWRpc3RvcmNlbnRlLmpzb24', 'mm5-bestia-distorcente', 'Bestia Distorcente', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-bestia-distorcente.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-bestia-distorcente",
  "general": {
    "name": "Bestia Distorcente",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmVzdGlhLWRpc3RvcmNlbnRlLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYm9sZXRvLXN0cmlkZW50ZS5qc29u', 'mm5-boleto-stridente', 'Boleto Stridente', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-boleto-stridente.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-boleto-stridente",
  "general": {
    "name": "Boleto Stridente",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Fungo Stridente"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYm9sZXRvLXN0cmlkZW50ZS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYnVsbHl3dWcuanNvbg', 'mm5-bullywug', 'Bullywug', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-bullywug.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-bullywug",
  "general": {
    "name": "Bullywug",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYnVsbHl3dWcuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2FjY2lhdG9yZS1pbnZpc2liaWxlLmpzb24', 'mm5-cacciatore-invisibile', 'Cacciatore Invisibile', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-cacciatore-invisibile.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-cacciatore-invisibile",
  "general": {
    "name": "Cacciatore Invisibile",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Persecutore Invisibile"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2FjY2lhdG9yZS1pbnZpc2liaWxlLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2FtYmlvbi5qc29u', 'mm5-cambion', 'Cambion', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-cambion.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-cambion",
  "general": {
    "name": "Cambion",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2FtYmlvbi5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2F2YWxpZXJlLWRlbGxhLW1vcnRlLmpzb24', 'mm5-cavaliere-della-morte', 'Cavaliere della Morte', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-cavaliere-della-morte.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-cavaliere-della-morte",
  "general": {
    "name": "Cavaliere della Morte",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2F2YWxpZXJlLWRlbGxhLW1vcnRlLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2F2YWxsby1kZWdsaS1pbmN1YmkuanNvbg', 'mm5-cavallo-degli-incubi', 'Cavallo degli Incubi', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-cavallo-degli-incubi.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-cavallo-degli-incubi",
  "general": {
    "name": "Cavallo degli Incubi",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Destriero da Incubo"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2F2YWxsby1kZWdsaS1pbmN1YmkuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2ljbG9wZS5qc29u', 'mm5-ciclope', 'Ciclope', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-ciclope.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-ciclope",
  "general": {
    "name": "Ciclope",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2ljbG9wZS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY3VzcGlkZS1sZXRhbGUuanNvbg', 'mm5-cuspide-letale', 'Cuspide Letale', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-cuspide-letale.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-cuspide-letale",
  "general": {
    "name": "Cuspide Letale",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY3VzcGlkZS1sZXRhbGUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGVtaWxpY2guanNvbg', 'mm5-demilich', 'Demilich', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-demilich.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-demilich",
  "general": {
    "name": "Demilich",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGVtaWxpY2guanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGV2YS5qc29u', 'mm5-deva', 'Deva', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-deva.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-deva",
  "general": {
    "name": "Deva",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Angelo Deva"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGV2YS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGlhdm9sby11bmNpbmF0by5qc29u', 'mm5-diavolo-uncinato', 'Diavolo Uncinato', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-diavolo-uncinato.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-diavolo-uncinato",
  "general": {
    "name": "Diavolo Uncinato",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGlhdm9sby11bmNpbmF0by5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGl2b3JhY2VydmVsbGkuanNvbg', 'mm5-divoracervelli', 'Divoracervelli', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-divoracervelli.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-divoracervelli",
  "general": {
    "name": "Divoracervelli",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGl2b3JhY2VydmVsbGkuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHJhY29saWNoLmpzb24', 'mm5-dracolich', 'Dracolich', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-dracolich.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-dracolich",
  "general": {
    "name": "Dracolich",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHJhY29saWNoLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHJhZ28tZC1vbWJyYS5qc29u', 'mm5-drago-d-ombra', 'Drago d''Ombra', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-drago-d-ombra.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-drago-d-ombra",
  "general": {
    "name": "Drago d''Ombra",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHJhZ28tZC1vbWJyYS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHJhZ28tZmF0YXRvLmpzb24', 'mm5-drago-fatato', 'Drago Fatato', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-drago-fatato.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-drago-fatato",
  "general": {
    "name": "Drago Fatato",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHJhZ28tZmF0YXRvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZW1waXJlby5qc29u', 'mm5-empireo', 'Empireo', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-empireo.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-empireo",
  "general": {
    "name": "Empireo",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZW1waXJlby5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZmF0YWxlLWRlbGwtYWNxdWEuanNvbg', 'mm5-fatale-dell-acqua', 'Fatale dell''Acqua', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-fatale-dell-acqua.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-fatale-dell-acqua",
  "general": {
    "name": "Fatale dell''Acqua",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZmF0YWxlLWRlbGwtYWNxdWEuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZmF1Y2UtZ29yZ29nbGlhbnRlLmpzb24', 'mm5-fauce-gorgogliante', 'Fauce Gorgogliante', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-fauce-gorgogliante.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-fauce-gorgogliante",
  "general": {
    "name": "Fauce Gorgogliante",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Fauci Gorgoglianti"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZmF1Y2UtZ29yZ29nbGlhbnRlLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZmx1bXBoLmpzb24', 'mm5-flumph', 'Flumph', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-flumph.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-flumph",
  "general": {
    "name": "Flumph",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZmx1bXBoLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZm9tb3JpYW4uanNvbg', 'mm5-fomorian', 'Fomorian', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-fomorian.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-fomorian",
  "general": {
    "name": "Fomorian",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZm9tb3JpYW4uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2FsZWItZHVoci5qc29u', 'mm5-galeb-duhr', 'Galeb Duhr', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-galeb-duhr.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-galeb-duhr",
  "general": {
    "name": "Galeb Duhr",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2FsZWItZHVoci5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHlhbmtpLWNhdmFsaWVyZS5qc29u', 'mm5-githyanki-cavaliere', 'Githyanki Cavaliere', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-githyanki-cavaliere.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-githyanki-cavaliere",
  "general": {
    "name": "Githyanki Cavaliere",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHlhbmtpLWNhdmFsaWVyZS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHlhbmtpLWNvbWJhdHRlbnRlLmpzb24', 'mm5-githyanki-combattente', 'Githyanki Combattente', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-githyanki-combattente.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-githyanki-combattente",
  "general": {
    "name": "Githyanki Combattente",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHlhbmtpLWNvbWJhdHRlbnRlLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHplcmFpLW1vbmFjby5qc29u', 'mm5-githzerai-monaco', 'Githzerai Monaco', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-githzerai-monaco.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-githzerai-monaco",
  "general": {
    "name": "Githzerai Monaco",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHplcmFpLW1vbmFjby5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHplcmFpLXplcnRoLmpzb24', 'mm5-githzerai-zerth', 'Githzerai Zerth', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-githzerai-zerth.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-githzerai-zerth",
  "general": {
    "name": "Githzerai Zerth",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ2l0aHplcmFpLXplcnRoLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ29yaXN0cm8uanNvbg', 'mm5-goristro', 'Goristro', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-goristro.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-goristro",
  "general": {
    "name": "Goristro",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ29yaXN0cm8uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ3JlbGwuanNvbg', 'mm5-grell', 'Grell', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-grell.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-grell",
  "general": {
    "name": "Grell",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZ3JlbGwuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUta2Vua3UuanNvbg', 'mm5-kenku', 'Kenku', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-kenku.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-kenku",
  "general": {
    "name": "Kenku",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUta2Vua3UuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFnbWluLmpzb24', 'mm5-magmin', 'Magmin', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-magmin.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-magmin",
  "general": {
    "name": "Magmin",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Uomo Magma (Magmin)"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFnbWluLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFyaWQuanNvbg', 'mm5-marid', 'Marid', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-marid.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-marid",
  "general": {
    "name": "Marid",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFyaWQuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFyaW5pZGUuanNvbg', 'mm5-marinide', 'Marinide', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-marinide.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-marinide",
  "general": {
    "name": "Marinide",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Uomo Acquatico"
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFyaW5pZGUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWVycm93Lmpzb24', 'mm5-merrow', 'Merrow', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-merrow.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-merrow",
  "general": {
    "name": "Merrow",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWVycm93Lmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWljb25pZGUtYWR1bHRvLmpzb24', 'mm5-miconide-adulto', 'Miconide Adulto', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-miconide-adulto.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-miconide-adulto",
  "general": {
    "name": "Miconide Adulto",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWljb25pZGUtYWR1bHRvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.491Z', '2026-04-12T13:32:40.491Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWljb25pZGUtZ2VybW9nbGlvLmpzb24', 'mm5-miconide-germoglio', 'Miconide Germoglio', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-miconide-germoglio.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-miconide-germoglio",
  "general": {
    "name": "Miconide Germoglio",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWljb25pZGUtZ2VybW9nbGlvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWljb25pZGUtc292cmFuby5qc29u', 'mm5-miconide-sovrano', 'Miconide Sovrano', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-miconide-sovrano.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-miconide-sovrano",
  "general": {
    "name": "Miconide Sovrano",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWljb25pZGUtc292cmFuby5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWluZC1mbGF5ZXIuanNvbg', 'mm5-mind-flayer', 'Mind Flayer', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-mind-flayer.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-mind-flayer",
  "general": {
    "name": "Mind Flayer",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWluZC1mbGF5ZXIuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbW9ub2Ryb25lLmpzb24', 'mm5-monodrone', 'Monodrone', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-monodrone.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-monodrone",
  "general": {
    "name": "Monodrone",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbW9ub2Ryb25lLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHVvZHJvbmUuanNvbg', 'mm5-duodrone', 'Duodrone', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-duodrone.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-duodrone",
  "general": {
    "name": "Duodrone",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZHVvZHJvbmUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdHJpZHJvbmUuanNvbg', 'mm5-tridrone', 'Tridrone', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-tridrone.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-tridrone",
  "general": {
    "name": "Tridrone",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdHJpZHJvbmUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcXVhZHJvbmUuanNvbg', 'mm5-quadrone', 'Quadrone', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-quadrone.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-quadrone",
  "general": {
    "name": "Quadrone",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcXVhZHJvbmUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGVudGFkcm9uZS5qc29u', 'mm5-pentadrone', 'Pentadrone', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-pentadrone.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-pentadrone",
  "general": {
    "name": "Pentadrone",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGVudGFkcm9uZS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWVmaXQtZGVsLWZhbmdvLmpzb24', 'mm5-mefit-del-fango', 'Mefit del Fango', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-mefit-del-fango.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-mefit-del-fango",
  "general": {
    "name": "Mefit del Fango",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWVmaXQtZGVsLWZhbmdvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWVmaXQtZGVsLWZ1bW8uanNvbg', 'mm5-mefit-del-fumo', 'Mefit del Fumo', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-mefit-del-fumo.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-mefit-del-fumo",
  "general": {
    "name": "Mefit del Fumo",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWVmaXQtZGVsLWZ1bW8uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbmFnYS1kLW9zc2EuanNvbg', 'mm5-naga-d-ossa', 'Naga d''Ossa', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-naga-d-ossa.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-naga-d-ossa",
  "general": {
    "name": "Naga d''Ossa",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbmFnYS1kLW9zc2EuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbmFnYS1ndWFyZGlhbmEuanNvbg', 'mm5-naga-guardiana', 'Naga Guardiana', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-naga-guardiana.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-naga-guardiana",
  "general": {
    "name": "Naga Guardiana",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Naga Guardiano"
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbmFnYS1ndWFyZGlhbmEuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbm90aGljLmpzb24', 'mm5-nothic', 'Nothic', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-nothic.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-nothic",
  "general": {
    "name": "Nothic",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbm90aGljLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtb3Jyb3JlLWNvcmF6emF0by5qc29u', 'mm5-orrore-corazzato', 'Orrore Corazzato', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-orrore-corazzato.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-orrore-corazzato",
  "general": {
    "name": "Orrore Corazzato",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtb3Jyb3JlLWNvcmF6emF0by5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtb3Jyb3JlLXVuY2luYXRvLmpzb24', 'mm5-orrore-uncinato', 'Orrore Uncinato', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-orrore-uncinato.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-orrore-uncinato",
  "general": {
    "name": "Orrore Uncinato",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtb3Jyb3JlLXVuY2luYXRvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGVyeXRvbi5qc29u', 'mm5-peryton', 'Peryton', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-peryton.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-peryton",
  "general": {
    "name": "Peryton",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGVyeXRvbi5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGl4aWUuanNvbg', 'mm5-pixie', 'Pixie', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-pixie.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-pixie",
  "general": {
    "name": "Pixie",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGl4aWUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGxhbmV0YXIuanNvbg', 'mm5-planetar', 'Planetar', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-planetar.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-planetar",
  "general": {
    "name": "Planetar",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Angelo Planetar"
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcGxhbmV0YXIuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcXVhZ2dvdGguanNvbg', 'mm5-quaggoth', 'Quaggoth', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-quaggoth.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-quaggoth",
  "general": {
    "name": "Quaggoth",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcXVhZ2dvdGguanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcmV2ZW5hbnQuanNvbg', 'mm5-revenant', 'Revenant', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-revenant.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-revenant",
  "general": {
    "name": "Revenant",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcmV2ZW5hbnQuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcm9jLmpzb24', 'mm5-roc', 'Roc', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-roc.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-roc",
  "general": {
    "name": "Roc",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcm9jLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2NpYWNhbGxvLW1hbm5hcm8uanNvbg', 'mm5-sciacallo-mannaro', 'Sciacallo Mannaro', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-sciacallo-mannaro.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-sciacallo-mannaro",
  "general": {
    "name": "Sciacallo Mannaro",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2NpYWNhbGxvLW1hbm5hcm8uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtYmx1Lmpzb24', 'mm5-slaad-blu', 'Slaad Blu', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-slaad-blu.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-slaad-blu",
  "general": {
    "name": "Slaad Blu",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtYmx1Lmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtZGVsbGEtbW9ydGUuanNvbg', 'mm5-slaad-della-morte', 'Slaad della Morte', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-slaad-della-morte.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-slaad-della-morte",
  "general": {
    "name": "Slaad della Morte",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtZGVsbGEtbW9ydGUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtZ2lyaW5vLmpzb24', 'mm5-slaad-girino', 'Slaad Girino', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-slaad-girino.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-slaad-girino",
  "general": {
    "name": "Slaad Girino",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtZ2lyaW5vLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtZ3JpZ2lvLmpzb24', 'mm5-slaad-grigio', 'Slaad Grigio', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-slaad-grigio.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-slaad-grigio",
  "general": {
    "name": "Slaad Grigio",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtZ3JpZ2lvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtcm9zc28uanNvbg', 'mm5-slaad-rosso', 'Slaad Rosso', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-slaad-rosso.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-slaad-rosso",
  "general": {
    "name": "Slaad Rosso",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtcm9zc28uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtdmVyZGUuanNvbg', 'mm5-slaad-verde', 'Slaad Verde', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-slaad-verde.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-slaad-verde",
  "general": {
    "name": "Slaad Verde",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc2xhYWQtdmVyZGUuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc29sYXIuanNvbg', 'mm5-solar', 'Solar', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-solar.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-solar",
  "general": {
    "name": "Solar",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Angelo Solar"
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc29sYXIuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc3BhdmVudGFwYXNzZXJpLmpzb24', 'mm5-spaventapasseri', 'Spaventapasseri', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-spaventapasseri.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-spaventapasseri",
  "general": {
    "name": "Spaventapasseri",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc3BhdmVudGFwYXNzZXJpLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc3BldHRyby5qc29u', 'mm5-spettro', 'Spettro', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-spettro.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-spettro",
  "general": {
    "name": "Spettro",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc3BldHRyby5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc3BvcmEtZ2Fzc29zYS5qc29u', 'mm5-spora-gassosa', 'Spora Gassosa', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-spora-gassosa.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-spora-gassosa",
  "general": {
    "name": "Spora Gassosa",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtc3BvcmEtZ2Fzc29zYS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdGVzY2hpby1pbmZ1b2NhdG8uanNvbg', 'mm5-teschio-infuocato', 'Teschio Infuocato', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-teschio-infuocato.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-teschio-infuocato",
  "general": {
    "name": "Teschio Infuocato",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdGVzY2hpby1pbmZ1b2NhdG8uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdGhyaS1rcmVlbi5qc29u', 'mm5-thri-kreen', 'Thri-kreen', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-thri-kreen.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-thri-kreen",
  "general": {
    "name": "Thri-kreen",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdGhyaS1rcmVlbi5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdHJlYW50Lmpzb24', 'mm5-treant', 'Treant', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-treant.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-treant",
  "general": {
    "name": "Treant",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "possible-duplicate",
    "possibleDuplicateOf": "Uomo Albero (Treant)"
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdHJlYW50Lmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdHJvZ2xvZGl0YS5qc29u', 'mm5-troglodita', 'Troglodita', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-troglodita.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-troglodita",
  "general": {
    "name": "Troglodita",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdHJvZ2xvZGl0YS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdWx0cm9sb3RoLmpzb24', 'mm5-ultroloth', 'Ultroloth', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-ultroloth.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-ultroloth",
  "general": {
    "name": "Ultroloth",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdWx0cm9sb3RoLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdW1iZXItaHVsay5qc29u', 'mm5-umber-hulk', 'Umber Hulk', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-umber-hulk.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-umber-hulk",
  "general": {
    "name": "Umber Hulk",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdW1iZXItaHVsay5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdmVybWVpZW5hLmpzb24', 'mm5-vermeiena', 'Vermeiena', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-vermeiena.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-vermeiena",
  "general": {
    "name": "Vermeiena",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtdmVybWVpZW5hLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteWV0aS5qc29u', 'mm5-yeti', 'Yeti', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-yeti.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-yeti",
  "general": {
    "name": "Yeti",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteWV0aS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteW9jaGxvbC5qc29u', 'mm5-yochlol', 'Yochlol', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-yochlol.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-yochlol",
  "general": {
    "name": "Yochlol",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteW9jaGxvbC5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteXVhbi10aS1hYm9taW5pby5qc29u', 'mm5-yuan-ti-abominio', 'Yuan-ti Abominio', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-yuan-ti-abominio.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-yuan-ti-abominio",
  "general": {
    "name": "Yuan-ti Abominio",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteXVhbi10aS1hYm9taW5pby5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.492Z', '2026-04-12T13:32:40.492Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteXVhbi10aS1uZWZhc3RvLmpzb24', 'mm5-yuan-ti-nefasto', 'Yuan-ti Nefasto', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-yuan-ti-nefasto.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-yuan-ti-nefasto",
  "general": {
    "name": "Yuan-ti Nefasto",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUteXVhbi10aS1uZWZhc3RvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYWdvLW1hbGlnbm8uanNvbg', 'mm5-ago-maligno', 'Ago Maligno', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-ago-maligno.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-ago-maligno",
  "general": {
    "name": "Ago Maligno",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYWdvLW1hbGlnbm8uanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYWxsb3NhdXJvLmpzb24', 'mm5-allosauro', 'Allosauro', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-allosauro.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-allosauro",
  "general": {
    "name": "Allosauro",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYWxsb3NhdXJvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYW5jaGlsb3NhdXJvLmpzb24', 'mm5-anchilosauro', 'Anchilosauro', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-anchilosauro.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-anchilosauro",
  "general": {
    "name": "Anchilosauro",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYW5jaGlsb3NhdXJvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYXJidXN0by1tYWxpZ25vLmpzb24', 'mm5-arbusto-maligno', 'Arbusto Maligno', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-arbusto-maligno.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-arbusto-maligno",
  "general": {
    "name": "Arbusto Maligno",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYXJidXN0by1tYWxpZ25vLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYXJjYW5hbG90aC5qc29u', 'mm5-arcanaloth', 'Arcanaloth', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-arcanaloth.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-arcanaloth",
  "general": {
    "name": "Arcanaloth",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYXJjYW5hbG90aC5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmFybGd1cmEuanNvbg', 'mm5-barlgura', 'Barlgura', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-barlgura.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-barlgura",
  "general": {
    "name": "Barlgura",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtYmFybGd1cmEuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2hhc21lLmpzb24', 'mm5-chasme', 'Chasme', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-chasme.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-chasme",
  "general": {
    "name": "Chasme",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtY2hhc21lLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGFvLmpzb24', 'mm5-dao', 'Dao', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-dao.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-dao",
  "general": {
    "name": "Dao",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGFvLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGVtb25lLWQtb21icmEuanNvbg', 'mm5-demone-d-ombra', 'Demone d''Ombra', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-demone-d-ombra.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-demone-d-ombra",
  "general": {
    "name": "Demone d''Ombra",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZGVtb25lLWQtb21icmEuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZWxlbWVudGFsZS1kZWxsLWFyaWEuanNvbg', 'mm5-elementale-dell-aria', 'Elementale dell''Aria', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-elementale-dell-aria.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-elementale-dell-aria",
  "general": {
    "name": "Elementale dell''Aria",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZWxlbWVudGFsZS1kZWxsLWFyaWEuanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZWxlbWVudGFsZS1kZWxsLWFjcXVhLmpzb24', 'mm5-elementale-dell-acqua', 'Elementale dell''Acqua', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-elementale-dell-acqua.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-elementale-dell-acqua",
  "general": {
    "name": "Elementale dell''Acqua",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtZWxlbWVudGFsZS1kZWxsLWFjcXVhLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFuZS5qc29u', 'mm5-mane', 'Mane', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-mane.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-mane",
  "general": {
    "name": "Mane",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWFuZS5qc29u', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWV6em9sb3RoLmpzb24', 'mm5-mezzoloth', 'Mezzoloth', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-mezzoloth.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-mezzoloth",
  "general": {
    "name": "Mezzoloth",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbWV6em9sb3RoLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbnljYWxvdGguanNvbg', 'mm5-nycaloth', 'Nycaloth', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-nycaloth.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-nycaloth",
  "general": {
    "name": "Nycaloth",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtbnljYWxvdGguanNvbg', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcHRlcmFub2RvbnRlLmpzb24', 'mm5-pteranodonte', 'Pteranodonte', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-pteranodonte.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-pteranodonte",
  "general": {
    "name": "Pteranodonte",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcHRlcmFub2RvbnRlLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
INSERT INTO "Monster" ("id", "slug", "name", "sourceType", "sourceFile", "challengeRatingDisplay", "challengeRatingDecimal", "challengeRatingXp", "size", "creatureType", "rarity", "alignment", "data", "createdAt", "updatedAt") VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcmFtcGljYW50ZS1tYWxpZ25vLmpzb24', 'mm5-rampicante-maligno', 'Rampicante Maligno', 'CUSTOM', 'custom/manuale-mostri-5-0/mm5-rampicante-maligno.json', '0', 0, 0, 'Media', '', NULL, '', '{
  "slug": "mm5-rampicante-maligno",
  "general": {
    "name": "Rampicante Maligno",
    "challengeRating": {
      "fraction": "0",
      "decimal": 0,
      "display": "0",
      "xp": 0
    },
    "size": "Media",
    "creatureType": "",
    "subtype": "",
    "typeLabel": "",
    "alignment": "",
    "environments": []
  },
  "combat": {
    "armorClass": {
      "value": 10,
      "note": "placeholder"
    },
    "hitPoints": {
      "average": 1,
      "formula": "1d8"
    },
    "speed": {
      "walk": "9 m"
    }
  },
  "abilities": {
    "strength": 10,
    "dexterity": 10,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 10,
    "charisma": 10
  },
  "details": {
    "savingThrows": [],
    "skills": [],
    "damageVulnerabilities": [],
    "damageResistances": [],
    "damageImmunities": [],
    "conditionImmunities": [],
    "senses": [],
    "languages": [],
    "proficiencyBonus": 2
  },
  "traits": [],
  "actions": [],
  "bonusActions": [],
  "reactions": [],
  "legendaryActions": {
    "description": "",
    "actions": []
  },
  "lairActions": [],
  "regionalEffects": [],
  "notes": [],
  "source": {
    "extractedFrom": "Manuale_dei_Mostri_5.0.pdf",
    "rawText": "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.",
    "importCategory": "manual-only",
    "possibleDuplicateOf": null
  }
}', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("id") DO UPDATE SET
  "slug" = excluded."slug",
  "name" = excluded."name",
  "sourceType" = excluded."sourceType",
  "sourceFile" = excluded."sourceFile",
  "challengeRatingDisplay" = excluded."challengeRatingDisplay",
  "challengeRatingDecimal" = excluded."challengeRatingDecimal",
  "challengeRatingXp" = excluded."challengeRatingXp",
  "size" = excluded."size",
  "creatureType" = excluded."creatureType",
  "rarity" = excluded."rarity",
  "alignment" = excluded."alignment",
  "data" = excluded."data",
  "updatedAt" = excluded."updatedAt";
INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")
VALUES ('Y3VzdG9tL21hbnVhbGUtbW9zdHJpLTUtMC9tbTUtcmFtcGljYW50ZS1tYWxpZ25vLmpzb24', 'UNKNOWN', '2026-04-12T13:32:40.493Z', '2026-04-12T13:32:40.493Z')
ON CONFLICT("monsterId") DO NOTHING;
COMMIT;
