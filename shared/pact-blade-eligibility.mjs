const normalized = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

/** Patto della Lama is a 3rd-level Pact Boon, not the 1st-level patron. */
export function canUsePactBlade(character) {
  const classes = Array.isArray(character?.classes) ? character.classes : null;
  const warlockClass = classes?.find((entry) =>
    normalized(entry?.classKey ?? entry?.label) === "warlock"
  );
  const warlockLevel = classes?.length
    ? Number(warlockClass?.level ?? 0)
    : normalized(character?.basicInfo?.class) === "warlock" ? Number(character?.basicInfo?.level ?? 0) : 0;
  if (warlockLevel < 3) return false;

  if (["blade", "pact-blade", "patto della lama"].includes(normalized(character?.pactBoon))) return true;
  const grants = [character?.features, character?.capabilities, character?.creationCapabilities]
    .filter(Array.isArray).flat();
  return grants.some((entry) => {
    const name = normalized(entry?.name ?? entry?.label);
    const id = normalized(entry?.sourceFeatureId ?? entry?.key);
    return name.includes("patto della lama") || name.includes("pact of the blade")
      || name === "lama assetata" || name === "thirsting blade"
      || id.includes("pact-blade") || id.includes("pact-of-the-blade");
  });
}
