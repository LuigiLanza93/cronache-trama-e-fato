import { expect, test } from "vitest";
import { BACKGROUNDS, FEATS, LEVEL_ONE_CLASSES, RACES } from "../../shared/character-creation-rules.mjs";
import {
  BACKGROUND_RULE_DESCRIPTIONS,
  CLASS_FEATURE_RULE_DESCRIPTIONS,
  FEATURE_RULE_DESCRIPTIONS,
  FEAT_RULE_DESCRIPTIONS,
} from "../../shared/character-creation-feature-descriptions.mjs";

test("every guided level-one origin grant has a usable rule description", () => {
  const missing = [];
  for (const [raceKey, race] of Object.entries(RACES)) {
    for (const feature of race.features ?? []) {
      if (!FEATURE_RULE_DESCRIPTIONS[feature.key]) missing.push(`${raceKey}:${feature.key}`);
    }
    for (const [subraceKey, subrace] of Object.entries(race.subraces ?? {})) {
      for (const feature of subrace.features ?? []) {
        if (!FEATURE_RULE_DESCRIPTIONS[feature.key]) missing.push(`${raceKey}:${subraceKey}:${feature.key}`);
      }
    }
  }
  for (const [classKey, classData] of Object.entries(LEVEL_ONE_CLASSES)) {
    for (const feature of classData.fixed.features ?? []) {
      if (!FEATURE_RULE_DESCRIPTIONS[feature.key] && !CLASS_FEATURE_RULE_DESCRIPTIONS[`${classKey}:${feature.key}`]) {
        missing.push(`${classKey}:${feature.key}`);
      }
    }
  }
  for (const key of Object.keys(BACKGROUNDS)) {
    if (!BACKGROUND_RULE_DESCRIPTIONS[key]) missing.push(`background:${key}`);
  }
  for (const key of Object.keys(FEATS)) {
    if (!FEAT_RULE_DESCRIPTIONS[key]) missing.push(`feat:${key}`);
  }
  for (const key of [
    "blessings-of-knowledge", "disciple-of-life", "bonus-cantrip-light", "warding-flare",
    "acolyte-of-nature", "wrath-of-the-storm", "blessing-of-the-trickster", "war-priest",
    "dragon-ancestor", "draconic-resilience", "wild-magic-surge", "tides-of-chaos",
    "fey-presence", "dark-ones-blessing", "awakened-mind", "domain-spells",
    "favored-enemy", "favored-humanoid", "favored-terrain", "natural-explorer",
    "fighting-style:archery", "fighting-style:defense", "fighting-style:dueling",
    "fighting-style:greatWeaponFighting", "fighting-style:protection", "fighting-style:twoWeaponFighting",
  ]) {
    if (!FEATURE_RULE_DESCRIPTIONS[key]) missing.push(key);
  }
  expect(missing).toEqual([]);
});
