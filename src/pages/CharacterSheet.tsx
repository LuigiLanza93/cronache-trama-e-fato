import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Heart, Shield, Zap, Sword } from "lucide-react";

interface Character {
  slug: string;
  basicInfo: {
    characterName: string;
    classAndLevel: string;
    background: string;
    playerName: string;
    race: string;
    alignment: string;
    experiencePoints: number;
  };
  abilityScores: {
    [key: string]: { score: number; modifier: number };
  };
  combatStats: {
    armorClass: number;
    initiative: number;
    speed: number;
    hitPointMaximum: number;
    currentHitPoints: number;
    temporaryHitPoints: number;
    hitDice: string;
  };
  proficiencies: {
    proficiencyBonus: number;
    savingThrows: string[];
    skills: Array<{ name: string; proficient: boolean }>;
    languages: string[];
  };
  equipment: {
    attacks: Array<{ name: string; attackBonus: number; damageType: string }>;
    equipment: string[];
  };
  features: Array<{ name: string; description: string; uses?: string }>;
}

const CharacterSheet = () => {
  const { character } = useParams();
  const [characterData, setCharacterData] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const data = await import(`@/data/characters/${character}.json`);
        setCharacterData(data.default);
      } catch (error) {
        console.error("Character not found:", error);
      } finally {
        setLoading(false);
      }
    };

    if (character) {
      loadCharacter();
    }
  }, [character]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment">
        <div className="text-center">
          <h2 className="text-2xl font-heading text-primary">Loading Character Sheet...</h2>
        </div>
      </div>
    );
  }

  if (!characterData) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment">
        <div className="text-center">
          <h2 className="text-2xl font-heading text-primary">Character Not Found</h2>
          <p className="text-muted-foreground mt-2">
            The character "{character}" does not exist.
          </p>
          <Button asChild className="mt-4">
            <a href="/">Return Home</a>
          </Button>
        </div>
      </div>
    );
  }

  const getAbilityModifierText = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : modifier.toString();
  };

  return (
    <div className="min-h-screen parchment p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Character Header */}
        <div className="dnd-frame-thick p-6 text-center">
          <h1 className="text-4xl font-heading font-bold text-primary mb-2">
            {characterData.basicInfo.characterName}
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">CLASS & LEVEL</Label>
              <div className="font-semibold">{characterData.basicInfo.classAndLevel}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">BACKGROUND</Label>
              <div className="font-semibold">{characterData.basicInfo.background}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">PLAYER NAME</Label>
              <div className="font-semibold">{characterData.basicInfo.playerName}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">RACE</Label>
              <div className="font-semibold">{characterData.basicInfo.race}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">ALIGNMENT</Label>
              <div className="font-semibold">{characterData.basicInfo.alignment}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">EXPERIENCE POINTS</Label>
              <div className="font-semibold">{characterData.basicInfo.experiencePoints}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Ability Scores */}
          <div className="space-y-6">
            <Card className="character-section">
              <div className="character-section-title">Ability Scores</div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(characterData.abilityScores).map(([ability, data]) => (
                  <div key={ability} className="ability-score">
                    <div className="text-xs text-center font-medium text-muted-foreground uppercase">
                      {ability.slice(0, 3)}
                    </div>
                    <div className="ability-score-value">{data.score}</div>
                    <div className="ability-score-modifier">
                      {getAbilityModifierText(data.modifier)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="character-section">
              <div className="character-section-title">Proficiency & Skills</div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">PROFICIENCY BONUS</Label>
                  <div className="text-lg font-bold text-primary">
                    +{characterData.proficiencies.proficiencyBonus}
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">SAVING THROWS</Label>
                  <div className="space-y-1">
                    {characterData.proficiencies.savingThrows.map((save) => (
                      <Badge key={save} variant="secondary" className="mr-1">
                        {save}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">SKILLS</Label>
                  <div className="space-y-1 text-sm">
                    {characterData.proficiencies.skills
                      .filter(skill => skill.proficient)
                      .map((skill) => (
                        <div key={skill.name} className="text-primary font-medium">
                          {skill.name}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Center Column - Combat Stats */}
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="dnd-frame p-4 text-center">
                <Shield className="w-6 h-6 mx-auto text-primary mb-1" />
                <div className="text-xs text-muted-foreground">ARMOR CLASS</div>
                <div className="text-2xl font-bold text-primary">
                  {characterData.combatStats.armorClass}
                </div>
              </Card>
              <Card className="dnd-frame p-4 text-center">
                <Zap className="w-6 h-6 mx-auto text-primary mb-1" />
                <div className="text-xs text-muted-foreground">INITIATIVE</div>
                <div className="text-2xl font-bold text-primary">
                  {getAbilityModifierText(characterData.combatStats.initiative)}
                </div>
              </Card>
              <Card className="dnd-frame p-4 text-center">
                <div className="text-xs text-muted-foreground">SPEED</div>
                <div className="text-2xl font-bold text-primary">
                  {characterData.combatStats.speed}
                </div>
              </Card>
            </div>

            <Card className="character-section">
              <div className="character-section-title flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Hit Points
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Label className="text-xs text-muted-foreground">MAXIMUM</Label>
                    <div className="text-xl font-bold text-primary">
                      {characterData.combatStats.hitPointMaximum}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CURRENT</Label>
                    <Input 
                      defaultValue={characterData.combatStats.currentHitPoints}
                      className="text-center text-lg font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">TEMPORARY</Label>
                    <Input 
                      defaultValue={characterData.combatStats.temporaryHitPoints}
                      className="text-center text-lg font-bold"
                    />
                  </div>
                </div>
                <div className="text-center">
                  <Label className="text-xs text-muted-foreground">HIT DICE</Label>
                  <div className="text-lg font-bold text-primary">
                    {characterData.combatStats.hitDice}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="character-section">
              <div className="character-section-title flex items-center gap-2">
                <Sword className="w-5 h-5 text-primary" />
                Attacks & Spellcasting
              </div>
              <div className="space-y-3">
                {characterData.equipment.attacks.map((attack, index) => (
                  <div key={index} className="dnd-frame p-3">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-primary">{attack.name}</div>
                      <div className="text-sm text-muted-foreground">
                        +{attack.attackBonus} / {attack.damageType}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column - Features & Equipment */}
          <div className="space-y-6">
            <Card className="character-section">
              <div className="character-section-title">Features & Traits</div>
              <div className="space-y-3">
                {characterData.features.map((feature, index) => (
                  <div key={index} className="dnd-frame p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-primary">{feature.name}</h4>
                      {feature.uses && (
                        <Badge variant="outline" className="text-xs">
                          {feature.uses}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="character-section">
              <div className="character-section-title">Equipment</div>
              <div className="space-y-2">
                {characterData.equipment.equipment.map((item, index) => (
                  <div key={index} className="text-sm">
                    • {item}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="character-section">
              <div className="character-section-title">Languages</div>
              <div className="flex flex-wrap gap-1">
                {characterData.proficiencies.languages.map((language) => (
                  <Badge key={language} variant="outline">
                    {language}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSheet;