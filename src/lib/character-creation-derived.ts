type AbilityScores = Record<string, number | undefined>;
type GuidedCreationState = {
  creation?: {
    resolved?: {
      identity?: { classKey?: string };
      choices?: Record<string, string[]>;
    };
  } | null;
};

function modifier(score: number | undefined) {
  const safeScore = typeof score === "number" && Number.isFinite(score) ? score : 10;
  return Math.floor((safeScore - 10) / 2);
}

export function getGuidedInnateArmorClass(
  state: GuidedCreationState,
  abilityScores: AbilityScores,
  hasShieldEquipped: boolean
): { value: number; label: string } | null {
  const creation = state?.creation?.resolved;
  const dexterity = modifier(abilityScores.dexterity);
  if (creation?.identity?.classKey === "monk" && !hasShieldEquipped) {
    return { value: 10 + dexterity + modifier(abilityScores.wisdom), label: "Difesa Senza Armatura (Monaco)" };
  }
  if (creation?.identity?.classKey === "barbarian") {
    return { value: 10 + dexterity + modifier(abilityScores.constitution), label: "Difesa Senza Armatura (Barbaro)" };
  }
  if (creation?.identity?.classKey === "sorcerer" && creation.choices?.["class:sorcerer:origin"]?.includes("draconic-bloodline")) {
    return { value: 13 + dexterity, label: "Resilienza Draconica" };
  }
  return null;
}
