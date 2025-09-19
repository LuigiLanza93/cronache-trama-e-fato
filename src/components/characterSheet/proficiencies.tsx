import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Proficiencies = ({
    characterData,
    proficiencyBonus,
    deathSaves,
    setDeathSaves,
    calculateSkillValues,
}: any) => (
    <Card className="character-section">
        <div className="character-section-title">Competenze & Abilità</div>
        <div className="space-y-3">
            <div>
                <Label className="text-xs text-muted-foreground">Bonus competenze</Label>
                <div className="text-lg font-bold text-primary">
                    +{proficiencyBonus(characterData.basicInfo.level)}
                </div>
            </div>
            <Separator />
            <div>
                <Label className="text-xs text-muted-foreground">Tiri salvezza</Label>
                <div className="space-y-1">
                    {characterData.proficiencies.savingThrows.map((save: string) => (
                        <Badge key={save} variant="secondary" className="mr-1">
                            {save}
                        </Badge>
                    ))}
                </div>
                <div className="character-section-title flex items-center gap-2 mt-8">
                    Tiri Salvezza Morte
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1">Riuscita</Label>
                        <div className="flex gap-3">
                            {deathSaves.success.map((checked: boolean, i: number) => (
                                <label
                                    key={`success-${i}`}
                                    className={`flex flex-col items-center cursor-pointer ${checked ? "opacity-100" : "opacity-70"}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={i > 0 && !deathSaves.success[i - 1]}
                                        onChange={() => {
                                            const next = [...deathSaves.success];
                                            next[i] = !next[i];
                                            if (!next[i]) {
                                                for (let j = i + 1; j < next.length; j++) next[j] = false;
                                            }
                                            setDeathSaves({ ...deathSaves, success: next });
                                        }}
                                        aria-label={`Riuscita ${i + 1}`}
                                        className="w-5 h-5 accent-green-600 rounded border-2 border-green-400"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground mb-1">Fallimento</Label>
                        <div className="flex gap-3">
                            {deathSaves.fail.map((checked: boolean, i: number) => (
                                <label
                                    key={`fail-${i}`}
                                    className={`flex flex-col items-center cursor-pointer ${checked ? "opacity-100" : "opacity-70"}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={i > 0 && !deathSaves.fail[i - 1]}
                                        onChange={() => {
                                            const next = [...deathSaves.fail];
                                            next[i] = !next[i];
                                            if (!next[i]) {
                                                for (let j = i + 1; j < next.length; j++) next[j] = false;
                                            }
                                            setDeathSaves({ ...deathSaves, fail: next });
                                        }}
                                        aria-label={`Fallimento ${i + 1}`}
                                        className="deathsave-checkbox w-5 h-5 accent-red-600 rounded border-2 border-red-400"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <Separator />
            <div className="!mt-6">
                <Label className="text-xs text-muted-foreground">Abilità</Label>
                <div className="space-y-1 text-sm">
                    {calculateSkillValues(characterData).map((skill: any) => (
                        <div key={skill.name} className="text-primary font-medium">
                            {skill.name} ({skill.ability.slice(0, 3)}):{" "}
                            <span className="text-black">{skill.value >= 0 ? `+${skill.value}` : skill.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </Card>
);

export default Proficiencies;