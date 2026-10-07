import { expect, test } from "vitest";
import { canUsePactBlade } from "../../shared/pact-blade-eligibility.mjs";

test("Pact Blade requires a Warlock of level three with the matching Pact Boon", () => {
  expect(canUsePactBlade({ basicInfo: { class: "Warlock", level: 1 }, features: [{ name: "Patto della Lama" }] })).toBe(false);
  expect(canUsePactBlade({ basicInfo: { class: "Warlock", level: 3 }, features: [{ name: "Patrono Ultraterreno" }] })).toBe(false);
  expect(canUsePactBlade({ basicInfo: { class: "Warlock", level: 3 }, features: [{ name: "Patto della Lama" }] })).toBe(true);
  expect(canUsePactBlade({ basicInfo: { class: "Warlock", level: 5 }, capabilities: [{ name: "Lama Assetata" }] })).toBe(true);
  expect(canUsePactBlade({ basicInfo: { class: "Guerriero", level: 3 }, features: [{ name: "Patto della Lama" }] })).toBe(false);
  expect(canUsePactBlade({ classes: [{ classKey: "warlock", level: 3 }], features: [{ name: "Patto della Lama" }] })).toBe(true);
});
