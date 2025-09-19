import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const Features = ({
    characterData,
    stripName,
    parseClassFromFeatureTitle,
    parseLevelFromFeatureTitle,
    findSpell,
    openFeatureModal,
    setAddSpellOpen,
}: any) => (
    <Card className="character-section">
        <div className="character-section-title flex items-center justify-between">
            <span>Tratti e Abilità</span>
        </div>
        <div className="space-y-3">
            {characterData.features.map((feature: any, index: number) => {
                const baseName = stripName(feature.name);
                const cls = parseClassFromFeatureTitle(feature.name);
                const lvl = parseLevelFromFeatureTitle(feature.name);
                const match = findSpell(baseName, cls, lvl);

                return (
                    <button
                        key={index}
                        onClick={() => openFeatureModal(feature)}
                        className="w-full text-left dnd-frame p-3 rounded hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <div className="flex justify-between items-start">
                            <div className="min-w-0">
                                <div className="font-semibold text-primary truncate">{baseName}</div>
                                {match ? (
                                    <div className="text-xs text-muted-foreground">
                                        Lv {match.level} · {match.school}
                                        {match.concentration ? " · Concentrazione" : ""}{match.ritual ? " · Rituale" : ""}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground line-clamp-1">{feature.description}</div>
                                )}
                            </div>
                            {feature.uses && (
                                <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                    {feature.uses}
                                </Badge>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
        <Button size="sm" onClick={() => setAddSpellOpen(true)}>Aggiungi incantesimo</Button>
    </Card>
);

export default Features;