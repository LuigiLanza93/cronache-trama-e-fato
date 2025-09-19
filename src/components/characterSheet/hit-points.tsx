import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateCharacter } from "@/realtime";

const HitPoints = ({
    characterData,
    setCharacterData,
    editDiceMode,
    setEditDiceMode,
    makeChangeHandler,
    abilityModifier,
}: any) => {
    useEffect(() => {
        // Calculate max HP
        const conMod = abilityModifier(characterData.abilityScores["constitution"]);
        const dice = parseInt(characterData.combatStats.hitDice.split("d")[1], 10);
        const maxHP = (conMod + dice) * characterData.basicInfo.level;
        if (characterData.combatStats.hitPointMaximum !== maxHP) {
            setCharacterData((prev: any) => ({
                ...prev,
                combatStats: {
                    ...prev.combatStats,
                    hitPointMaximum: maxHP,
                },
            }));
            // Update on server (and JSON file)
            if (characterData.slug) {
                updateCharacter(characterData.slug, { combatStats: { hitPointMaximum: maxHP } });
            }
        }
    }, [
        characterData.abilityScores["constitution"],
        characterData.combatStats.hitDice,
        characterData.basicInfo.level,
        setCharacterData,
        characterData.combatStats.hitPointMaximum,
        characterData.slug,
    ]);

    return (
        <Card className="character-section">
            <div className="character-section-title flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Punti ferita
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <Label className="text-xs text-muted-foreground">Totali</Label>
                        <div className="flex items-center justify-center text-xl gap-2 font-bold text-primary">
                            <Input
                                value={characterData.combatStats.currentHitPoints}
                                className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                                onChange={makeChangeHandler("combatStats.currentHitPoints", "int")}
                            />
                            /
                            <span>{characterData.combatStats.hitPointMaximum + characterData.combatStats.temporaryHitPoints}</span>
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Temporanei</Label>
                        <Input
                            value={characterData.combatStats.temporaryHitPoints}
                            className="text-center text-lg font-bold"
                            onChange={makeChangeHandler("combatStats.temporaryHitPoints", "int")}
                        />
                    </div>
                </div>
                <div className="text-center">
                    <Label className="text-xs text-muted-foreground">Dado Vita</Label>
                    {editDiceMode ? (
                        <Input value={characterData.combatStats.hitDice} onChange={makeChangeHandler("combatStats.hitDice")} />
                    ) : (
                        <div className="text-lg font-bold text-primary">{characterData.combatStats.hitDice}</div>
                    )}
                    <div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 bg-primary text-white"
                            onClick={() => setEditDiceMode(!editDiceMode)}
                        >
                            {editDiceMode ? "Salva" : "Modifica"}
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    )
};

export default HitPoints;