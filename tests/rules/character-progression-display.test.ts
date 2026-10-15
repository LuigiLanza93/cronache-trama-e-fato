import { describe, expect, it } from "vitest";
import { getSubclassPreviewRows } from "../../src/lib/character-progression";

describe("multiclass subclass preview", () => {
  it("shows the existing patron alongside the new sorcerous origin", () => {
    expect(getSubclassPreviewRows([
      { classKey: "warlock", label: "Warlock", level: 5, subclass: { subclassKey: "the-fiend", label: "Immondo" } },
    ], [
      { classKey: "warlock", level: 5, subclassKey: "the-fiend" },
      { classKey: "sorcerer", level: 1, subclassKey: "draconic-bloodline" },
    ])).toEqual([
      { classKey: "warlock", label: "Warlock", before: "Immondo", after: "Immondo" },
      { classKey: "sorcerer", label: "Stregone", before: "Nessuna", after: "Discendenza Draconica" },
    ]);
  });

  it("retains subclasses of every other class while advancing a target", () => {
    const before = [
      { classKey: "fighter", level: 3, subclass: { subclassKey: "champion" } },
      { classKey: "sorcerer", level: 1, subclass: { subclassKey: "draconic-bloodline" } },
    ];
    const rows = getSubclassPreviewRows(before, [
      { classKey: "fighter", level: 3, subclassKey: "champion" },
      { classKey: "sorcerer", level: 2, subclassKey: "draconic-bloodline" },
    ]);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.after).toBe(row.before);
  });

  it("shows the saved dragon choice on both sides of the preview", () => {
    const [row] = getSubclassPreviewRows([
      { classKey: "sorcerer", level: 1, subclass: { subclassKey: "draconic-bloodline" },
        draconicAncestry: { key: "blue", label: "Blu", damageType: "lightning", damageLabel: "Fulmine" } },
    ], [{ classKey: "sorcerer", level: 2, subclassKey: "draconic-bloodline", draconicAncestryKey: "blue" }]);
    expect(row.before).toBe("Discendenza Draconica · Blu (Fulmine)");
    expect(row.after).toBe(row.before);
  });
});
