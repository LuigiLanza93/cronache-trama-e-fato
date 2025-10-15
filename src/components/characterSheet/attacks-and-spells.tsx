import { Card } from "@/components/ui/card";
import { Sword } from "lucide-react";
import { Button } from "@/components/ui/button";

type SkillType = "volonta" | "incontro" | "riposoBreve" | "riposoLungo";

const LABELS: Record<SkillType, string> = {
  volonta: "Volontà",
  incontro: "Incontro",
  riposoBreve: "Riposo Breve",
  riposoLungo: "Riposo Lungo",
};

/** Parser legacy: "1d8+3 tagliente" -> { dice, type } */
function parseLegacyDamage(s: string | undefined): { dice?: string; type?: string } {
  const src = (s ?? "").trim();
  if (!src) return {};
  const m = src.match(/^\s*([^\s]+)\s+(tagliente|perforante|contundente)\s*$/i);
  if (m) return { dice: m[1], type: m[2].toLowerCase() };
  return { dice: src };
}

/** Dettaglio per righe armi (nuovi campi + fallback legacy) */
function buildAttackDetail(attack: any): string {
  const bonus = `+${attack.attackBonus}`;
  const diceNew: string | undefined = attack.damageDice;
  const typeNew: string | undefined = attack.damageType; // ora solo tipo
  const cat: "melee" | "ranged" | undefined = attack.category;
  const hands =
    cat === "melee" && attack.hands
      ? attack.hands === "1"
        ? " • 1 mano"
        : attack.hands === "2"
        ? " • 2 mani"
        : " • versatile"
      : "";
  const range = cat === "ranged" && attack.range ? ` • gittata: ${attack.range}` : "";

  const legacy = parseLegacyDamage(attack.damageType);
  const dice = diceNew ?? legacy.dice ?? "";
  const type = typeNew ?? legacy.type ?? "";
  const dmg = [dice, type].filter(Boolean).join(" ");
  return `${bonus} • ${dmg}${hands}${range}`;
}

const AttacksAndSpells = ({
  characterData,
  toggleEquipAttack,
  toggleAttackSkillUsed,
  toggleEquipItem,
  /** NEW: per spuntare le skill anche sugli OGGETTI */
  toggleItemSkillUsed,
}: {
  characterData: any;
  toggleEquipAttack: (i: number) => void;
  toggleAttackSkillUsed: (attackIndex: number, type: SkillType, skillIndex: number) => void;
  toggleEquipItem?: (i: number) => void;
  toggleItemSkillUsed?: (itemIndex: number, type: SkillType, skillIndex: number) => void;
}) => {
  const attacks = Array.isArray(characterData?.equipment?.attacks)
    ? characterData.equipment.attacks
    : [];
  const items = Array.isArray(characterData?.equipment?.items)
    ? characterData.equipment.items
    : [];

  // Mantengo l'indice originale per i toggle
  const equippedAttacks = attacks
    .map((a: any, i: number) => ({ a, i }))
    .filter(({ a }) => !!a.equipped);

  const equippedObjects = items
    .map((it: any, i: number) => ({ it, i }))
    .filter(
      ({ it }) => it?.type === "object" && it?.equippable === true && it?.equipped === true
    );

  return (
    <Card className="character-section">
      <div className="character-section-title flex items-center gap-2">
        <Sword className="w-5 h-5 text-primary" />
        Attacchi e incantesimi
      </div>

      <div className="space-y-4">
        {/* ====== Sezione: ARMI ====== */}
        {equippedAttacks.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold text-primary">Armi</div>
            {equippedAttacks.map(({ a: attack, i: originalIndex }) => {
              const byType = (attack.skillsByType ?? {}) as Partial<
                Record<SkillType, { name: string; used: boolean }[]>
              >;
              const hasAnyTyped =
                (byType.volonta?.length ?? 0) +
                  (byType.incontro?.length ?? 0) +
                  (byType.riposoBreve?.length ?? 0) +
                  (byType.riposoLungo?.length ?? 0) >
                0;

              const legacyFlat = Array.isArray(attack.skills) ? attack.skills : [];
              const legacySingle = attack.skill ? [attack.skill] : [];
              const hasLegacy = legacyFlat.length > 0 || legacySingle.length > 0;

              return (
                <div
                  key={`atk-${attack.name}-${originalIndex}`}
                  className="flex items-center justify-between text-sm dnd-frame p-2"
                >
                  <div className="flex-1">
                    <div className="font-medium">{attack.name}</div>
                    <div className="text-muted-foreground">{buildAttackDetail(attack)}</div>

                    {/* Skills per categoria */}
                    {hasAnyTyped && (
                      <div className="mt-2 space-y-1">
                        {(Object.keys(LABELS) as SkillType[]).map((t) => {
                          const arr = byType[t] ?? [];
                          if (arr.length === 0) return null;

                          return (
                            <div key={t} className="text-xs">
                              <div className="font-medium text-muted-foreground">{LABELS[t]}</div>

                              {/* Volontà: SOLO testo */}
                              {t === "volonta" ? (
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {arr.map((s, si) => (
                                    <span key={`${t}-${si}`} className="italic">
                                      {s.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                // Altri tipi: con checkbox
                                <div className="mt-1 flex flex-wrap gap-3">
                                  {arr.map((s, si) => (
                                    <label
                                      key={`${t}-${si}`}
                                      className="inline-flex items-center gap-1 cursor-pointer select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!s.used}
                                        onChange={() =>
                                          toggleAttackSkillUsed(originalIndex, t, si)
                                        }
                                        className="h-3 w-3"
                                        aria-label={`${LABELS[t]}: ${s.name}`}
                                      />
                                      <span className="italic">{s.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Dati legacy (solo visualizzazione) */}
                    {hasLegacy && (
                      <div className="mt-2 text-muted-foreground text-xs italic">
                        Altro: {[...legacySingle, ...legacyFlat].join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleEquipAttack(originalIndex)}>
                      Disequipaggia
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ====== Sezione: OGGETTI ====== */}
        {equippedObjects.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold text-primary">Oggetti</div>
            {equippedObjects.map(({ it, i }) => {
              const byType = (it.skillsByType ?? {}) as Partial<
                Record<SkillType, { name: string; used: boolean }[]>
              >;
              const hasAnyTyped =
                (byType.volonta?.length ?? 0) +
                  (byType.incontro?.length ?? 0) +
                  (byType.riposoBreve?.length ?? 0) +
                  (byType.riposoLungo?.length ?? 0) >
                0;

              return (
                <div
                  key={`obj-${it.name}-${i}`}
                  className="flex items-center justify-between text-sm dnd-frame p-2"
                >
                  <div className="flex-1">
                    <div className="font-medium">{it.name}</div>
                    {it.description && (
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {it.description}
                      </div>
                    )}

                    {/* Skills per categoria (OGGETTI) */}
                    {hasAnyTyped && (
                      <div className="mt-2 space-y-1">
                        {(Object.keys(LABELS) as SkillType[]).map((t) => {
                          const arr = byType[t] ?? [];
                          if (arr.length === 0) return null;

                          return (
                            <div key={`obj-${t}`} className="text-xs">
                              <div className="font-medium text-muted-foreground">
                                {LABELS[t]}
                              </div>

                              {t === "volonta" ? (
                                // Volontà: SOLO testo
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {arr.map((s, si) => (
                                    <span key={`obj-${t}-${si}`} className="italic">
                                      {s.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                // Altri tipi: con checkbox
                                <div className="mt-1 flex flex-wrap gap-3">
                                  {arr.map((s, si) => (
                                    <label
                                      key={`obj-${t}-${si}`}
                                      className="inline-flex items-center gap-1 cursor-pointer select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!s.used}
                                        onChange={() =>
                                          toggleItemSkillUsed?.(i, t, si)
                                        }
                                        className="h-3 w-3"
                                        aria-label={`${LABELS[t]}: ${s.name}`}
                                      />
                                      <span className="italic">{s.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!!toggleEquipItem && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleEquipItem(i)}>
                        Disequipaggia
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export default AttacksAndSpells;
