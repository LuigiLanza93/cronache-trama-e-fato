import { Card } from "@/components/ui/card";
import { Sword } from "lucide-react";
import { Button } from "@/components/ui/button";

const AttacksAndSpells = ({ characterData, toggleEquipAttack }: any) => (
    <Card className="character-section">
        <div className="character-section-title flex items-center gap-2">
            <Sword className="w-5 h-5 text-primary" />
            Attacchi e incantesimi
        </div>
        <div className="space-y-3">
            {characterData.equipment.attacks.map((attack: any, index: number) => {
                if (attack.equipped) {
                    return (
                        <div key={`${attack.name}-${index}`} className="flex items-center justify-between text-sm dnd-frame p-2">
                            <div className="flex-1">
                                <div className="font-medium">
                                    {attack.name} {attack.equipped ? "(equipaggiata)" : ""}
                                </div>
                                <div className="text-muted-foreground">+{attack.attackBonus} • {attack.damageType}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => toggleEquipAttack(index)}>
                                    Disequipaggia
                                </Button>
                            </div>
                        </div>
                    );
                }
            })}
        </div>
    </Card>
);

export default AttacksAndSpells;