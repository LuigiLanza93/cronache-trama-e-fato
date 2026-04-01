function parseChallengeRatingDecimal(challengeRating = {}) {
  if (typeof challengeRating?.decimal === "number" && Number.isFinite(challengeRating.decimal)) {
    return challengeRating.decimal;
  }

  const display = String(challengeRating?.display ?? challengeRating?.fraction ?? "").trim();
  if (!display) return null;
  if (display === "1/8") return 0.125;
  if (display === "1/4") return 0.25;
  if (display === "1/2") return 0.5;

  const numeric = Number(display);
  return Number.isFinite(numeric) ? numeric : null;
}

export function computeMonsterRarity({ creatureType = "", challengeRating = {} } = {}) {
  const type = String(creatureType ?? "").trim().toLocaleLowerCase("it-IT");
  const challengeDecimal = parseChallengeRatingDecimal(challengeRating);
  const isHighCr = typeof challengeDecimal === "number" && challengeDecimal >= 5;

  if (!type) return "";

  if (["bestia", "umanoide", "pianta", "sciame di minuscole bestie"].includes(type)) {
    return isHighCr ? "Non comune" : "Comune";
  }

  if (["mostruosit\u00E0", "gigante", "non morto", "fatato"].includes(type)) {
    return isHighCr ? "Raro" : "Non comune";
  }

  if (["aberrazione", "immondo", "celestiale", "elementale", "melma", "costrutto"].includes(type)) {
    return isHighCr ? "Molto raro" : "Raro";
  }

  if (type === "drago") {
    return typeof challengeDecimal === "number" && challengeDecimal > 15 ? "Leggendario" : "Molto raro";
  }

  return "";
}
