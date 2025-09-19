import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const AbilityScores = ({ characterData, makeChangeHandler, abilityModifier }: any) => (
    <Card className="character-section">
        <div className="character-section-title">Punti abilità</div>
        <div className="grid grid-cols-2 gap-3">
            {Object.entries(characterData.abilityScores).map(([ability, data]) => (
                <div key={ability} className="ability-score flex flex-col items-center">
                    <div className="text-xs text-center font-medium text-muted-foreground uppercase">
                        {ability.slice(0, 3)}
                    </div>
                    <Input
                        value={data as string}
                        className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                        onChange={makeChangeHandler(`abilityScores.${ability}`, "int")}
                    />
                    <div className="ability-score-modifier">{abilityModifier(data)}</div>
                </div>
            ))}
        </div>
    </Card>
);

export default AbilityScores;