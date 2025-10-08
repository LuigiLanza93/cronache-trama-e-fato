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

const AttacksAndSpells = ({ characterData, toggleEquipAttack, toggleAttackSkillUsed }: any) => (
  <Card className="character-section">
    <div className="character-section-title flex items-center gap-2">
      <Sword className="w-5 h-5 text-primary" />
      Attacchi e incantesimi
    </div>
    <div className="space-y-3">
      {characterData.equipment.attacks.map((attack: any, index: number) => {
        if (!attack.equipped) return null;

        const byType = (attack.skillsByType ?? {}) as Partial<Record<SkillType, { name: string; used: boolean }[]>>;
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
          <div key={`${attack.name}-${index}`} className="flex items-center justify-between text-sm dnd-frame p-2">
            <div className="flex-1">
              <div className="font-medium">
                {attack.name} {attack.equipped ? "(equipaggiata)" : ""}
              </div>
              <div className="text-muted-foreground">
                +{attack.attackBonus} • {attack.damageType}
              </div>

              {/* Skills per categoria */}
              {hasAnyTyped && (
                <div className="mt-2 space-y-1">
                  {(Object.keys(LABELS) as SkillType[]).map((t) => {
                    const arr = byType[t] ?? [];
                    if (arr.length === 0) return null;

                    return (
                      <div key={t} className="text-xs">
                        <div className="font-medium text-muted-foreground">{LABELS[t]}</div>

                        {/* Volontà: SOLO testo, niente checkbox */}
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
                                  onChange={() => toggleAttackSkillUsed(index, t, si)}
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
              <Button size="sm" variant="outline" onClick={() => toggleEquipAttack(index)}>
                Disequipaggia
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  </Card>
);

export default AttacksAndSpells;
