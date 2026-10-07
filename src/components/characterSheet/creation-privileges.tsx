import { Sparkles } from "lucide-react";

import SectionCard from "@/components/characterSheet/section-card";

type PassiveEffect = {
  category?: string;
  target?: string;
  value?: number;
  trigger?: string;
};

export type CreationPrivilege = {
  name: string;
  category?: string;
  kind: "active" | "passive";
  shortDescription: string;
  description?: string;
  sourceLabel?: string;
  passiveEffects?: PassiveEffect[];
};

const GROUP_ORDER = ["Razza", "Classe", "Background", "Alternative ai doppioni"];
const EFFECT_TARGETS: Record<string, string> = {
  ARMOR_CLASS: "Classe Armatura",
  RANGED_ATTACK_ROLL: "Tiri per colpire a distanza",
  MELEE_DAMAGE_ROLL: "Danni in mischia",
  ARMOR_LIGHT: "armature leggere",
  ARMOR_MEDIUM: "armature medie",
  ARMOR_HEAVY: "armature pesanti",
  SHIELD: "scudi",
};
const EFFECT_TRIGGERS: Record<string, string> = {
  ALWAYS: "sempre",
  WHILE_ARMORED: "mentre indossa un'armatura",
  WHILE_WIELDING_SINGLE_MELEE_WEAPON: "con una sola arma da mischia",
};

function effectLabel(effect: PassiveEffect) {
  const target = EFFECT_TARGETS[effect.target ?? ""] ?? effect.target ?? "Effetto";
  if (effect.category === "PROFICIENCY") return `Competenza: ${target}`;
  const value = Number(effect.value ?? 0);
  const signedValue = value >= 0 ? `+${value}` : `${value}`;
  return `${target} ${signedValue} · ${EFFECT_TRIGGERS[effect.trigger ?? ""] ?? "secondo le condizioni del privilegio"}`;
}

export default function CreationPrivileges({ privileges }: { privileges: CreationPrivilege[] }) {
  const groups = GROUP_ORDER.map((category) => ({
    category,
    entries: privileges.filter((privilege) => privilege.category === category),
  })).filter((group) => group.entries.length > 0);
  const other = privileges.filter((privilege) => !GROUP_ORDER.includes(privilege.category ?? ""));
  if (other.length) groups.push({ category: "Altri privilegi", entries: other });

  return (
    <SectionCard
      cardId="creationPrivileges"
      title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Privilegi di origine</span>}
    >
      <div className="space-y-3">
        {groups.map((group) => (
          <details key={group.category} className="rounded-lg border border-border/70 bg-background/50">
            <summary className="cursor-pointer px-4 py-3 font-semibold text-primary marker:text-primary">
              {group.category} <span className="ml-1 text-xs font-normal text-muted-foreground">({group.entries.length})</span>
            </summary>
            <div className="space-y-2 border-t border-border/60 p-3">
              {group.entries.map((privilege, index) => (
                <details key={`${privilege.name}-${index}`} className="rounded-md border border-border/60 bg-background/70">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary marker:text-primary">
                    {privilege.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{privilege.kind === "passive" ? "Passivo" : "Attivo"}</span>
                    {privilege.passiveEffects?.length ? <span className="ml-2 text-xs font-normal text-primary">· effetto applicato</span> : null}
                  </summary>
                  <div className="space-y-2 border-t border-border/50 px-3 py-3 text-sm">
                    <p className="whitespace-pre-line">{privilege.description || privilege.shortDescription}</p>
                    {privilege.sourceLabel ? <p className="text-xs text-muted-foreground">Origine: {privilege.sourceLabel}</p> : null}
                    {privilege.passiveEffects?.length ? (
                      <div className="space-y-1 border-t border-border/50 pt-2 text-xs">
                        <strong>Effetti automatici</strong>
                        {privilege.passiveEffects.map((effect, effectIndex) => <p key={`${privilege.name}-effect-${effectIndex}`}>{effectLabel(effect)}</p>)}
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </SectionCard>
  );
}
