export const PASSIVE_EFFECT_ALL_SKILLS_TARGET = "SKILL_ALL" as const;

export const PASSIVE_EFFECT_SKILL_TARGETS = [
  { target: PASSIVE_EFFECT_ALL_SKILLS_TARGET, label: "Tutte le abilita" },
  { target: "SKILL_ACROBAZIA", label: "Acrobazia", skillName: "Acrobazia" },
  { target: "SKILL_ADDESTRARE_ANIMALI", label: "Addestrare Animali", skillName: "Addestrare Animali" },
  { target: "SKILL_ARCANO", label: "Arcano", skillName: "Arcano" },
  { target: "SKILL_ATLETICA", label: "Atletica", skillName: "Atletica" },
  { target: "SKILL_INGANNO", label: "Inganno", skillName: "Inganno" },
  { target: "SKILL_STORIA", label: "Storia", skillName: "Storia" },
  { target: "SKILL_INTUIZIONE", label: "Intuizione", skillName: "Intuizione" },
  { target: "SKILL_INTIMIDIRE", label: "Intimidire", skillName: "Intimidire" },
  { target: "SKILL_INDAGARE", label: "Indagare", skillName: "Indagare" },
  { target: "SKILL_MEDICINA", label: "Medicina", skillName: "Medicina" },
  { target: "SKILL_NATURA", label: "Natura", skillName: "Natura" },
  { target: "SKILL_PERCEZIONE", label: "Percezione", skillName: "Percezione" },
  { target: "SKILL_INTRATTENERE", label: "Intrattenere", skillName: "Intrattenere" },
  { target: "SKILL_PERSUASIONE", label: "Persuasione", skillName: "Persuasione" },
  { target: "SKILL_RELIGIONE", label: "Religione", skillName: "Religione" },
  { target: "SKILL_RAPIDITA_DI_MANO", label: "Rapidita di Mano", skillName: "Rapidità di Mano" },
  { target: "SKILL_FURTIVITA", label: "Furtivita", skillName: "Furtività" },
  { target: "SKILL_SOPRAVVIVENZA", label: "Sopravvivenza", skillName: "Sopravvivenza" },
] as const;

export type PassiveEffectSkillTarget = (typeof PASSIVE_EFFECT_SKILL_TARGETS)[number]["target"];

const PASSIVE_EFFECT_SKILL_TARGET_BY_NAME = new Map(
  PASSIVE_EFFECT_SKILL_TARGETS.filter((entry) => "skillName" in entry).map((entry) => [
    normalizeSkillName(entry.skillName),
    entry.target,
  ])
);

export const PASSIVE_EFFECT_SKILL_TARGET_LABELS: Record<PassiveEffectSkillTarget, string> =
  PASSIVE_EFFECT_SKILL_TARGETS.reduce((acc, entry) => {
    acc[entry.target] = entry.label;
    return acc;
  }, {} as Record<PassiveEffectSkillTarget, string>);

export function normalizeSkillName(value: string | undefined | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isSkillPassiveEffectTarget(target: string | undefined | null): target is PassiveEffectSkillTarget {
  return PASSIVE_EFFECT_SKILL_TARGETS.some((entry) => entry.target === target);
}

export function getSkillPassiveEffectTargetForSkillName(skillName: string | undefined | null) {
  return PASSIVE_EFFECT_SKILL_TARGET_BY_NAME.get(normalizeSkillName(skillName));
}

export function matchesSkillPassiveEffectTarget(
  target: string | undefined | null,
  skillName: string | undefined | null
) {
  if (!isSkillPassiveEffectTarget(target)) return false;
  if (target === PASSIVE_EFFECT_ALL_SKILLS_TARGET) return true;
  return getSkillPassiveEffectTargetForSkillName(skillName) === target;
}
