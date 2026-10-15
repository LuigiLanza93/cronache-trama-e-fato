export const PACT_BOONS = Object.freeze({
  chain: Object.freeze({ key: "chain", label: "Patto della Catena" }),
  blade: Object.freeze({ key: "blade", label: "Patto della Lama" }),
  tome: Object.freeze({ key: "tome", label: "Patto del Tomo" }),
});
export const PACT_BOON_OPTIONS = Object.freeze(Object.values(PACT_BOONS));

export function normalizePactBoonKey(value) {
  return typeof value === "string" ? PACT_BOONS[value.trim().toLowerCase()]?.key ?? null : null;
}

export function pactBoonSummary(value) {
  const key = normalizePactBoonKey(value);
  return key ? { ...PACT_BOONS[key] } : null;
}

export function canUsePactBlade(character) {
  const warlock = character?.classes?.find((entry) => entry.classKey === "warlock");
  return Number(warlock?.level) >= 3 && (warlock?.pactBoonKey ?? warlock?.pactBoon?.key) === "blade";
}
