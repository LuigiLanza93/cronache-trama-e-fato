import { Card } from "@/components/ui/card";
import { Shield, Zap, FastForward } from "lucide-react";
import { Input } from "@/components/ui/input";

const CombatStats = ({ characterData, makeChangeHandler, abilityModifier }: any) => (
    <div className="grid grid-cols-3 gap-4">
        <Card className="flex flex-col dnd-frame p-4 text-center">
            <Shield className="w-6 h-6 mx-auto text-primary mb-1" />
            <div className="text-xs text-muted-foreground">Classe armatura</div>
            <div className="text-2xl font-bold text-primary mt-auto">
                <Input
                    value={characterData.combatStats.armorClass}
                    className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                    onChange={makeChangeHandler("combatStats.armorClass", "int")}
                />
            </div>
        </Card>
        <Card className="flex flex-col dnd-frame p-4 text-center">
            <Zap className="w-6 h-6 mx-auto text-primary mb-1" />
            <div className="text-xs text-muted-foreground">Iniziativa</div>
            <div className="text-2xl font-bold text-primary mt-auto">
                <Input
                    value={abilityModifier(characterData.abilityScores["dexterity"])}
                    className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                    onChange={makeChangeHandler("combatStats.initiative", "int")}
                />
            </div>
        </Card>
        <Card className="flex flex-col dnd-frame p-4 text-center">
            <FastForward className="w-6 h-6 mx-auto text-primary mb-1" />
            <div className="text-xs text-muted-foreground">Velocità</div>
            <div className="text-2xl font-bold text-primary mt-auto">
                <Input
                    value={characterData.combatStats.speed}
                    className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                    onChange={makeChangeHandler("combatStats.speed", "int")}
                />
            </div>
        </Card>
    </div>
);

export default CombatStats;