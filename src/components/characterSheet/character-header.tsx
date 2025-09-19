import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CharacterHeader = ({
    characterData,
    editMode,
    setEditMode,
    makeChangeHandler,
}: any) => (
    <div className="dnd-frame-thick p-6 text-center">
        <h1 className="text-4xl font-heading font-bold text-primary mb-2">
            {characterData.basicInfo.characterName} {characterData.combatStats.deathSaves?.failures > 0 && (
                <div className="inline-block text-2xl text-red-600 mb-2">
                    {Array.from({ length: characterData.combatStats.deathSaves.failures }).map((_, i) => (
                        <span key={i}>💀</span>
                    ))}
                </div>
            )}
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="grid grid-cols-2">
                <div>
                    <Label className="text-xs text-muted-foreground">Classe</Label>
                    {editMode ? (
                        <Input value={characterData.basicInfo.class} onChange={makeChangeHandler("basicInfo.class")} />
                    ) : (
                        <div className="font-semibold">{characterData.basicInfo.class}</div>
                    )}
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">Livello</Label>
                    {editMode ? (
                        <Input value={characterData.basicInfo.level} onChange={makeChangeHandler("basicInfo.level", "int")} />
                    ) : (
                        <div className="font-semibold">{characterData.basicInfo.level}</div>
                    )}
                </div>
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">Background</Label>
                {editMode ? (
                    <Input value={characterData.basicInfo.background} onChange={makeChangeHandler("basicInfo.background")} />
                ) : (
                    <div className="font-semibold">{characterData.basicInfo.background}</div>
                )}
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">Nome giocatore</Label>
                {editMode ? (
                    <Input value={characterData.basicInfo.playerName} onChange={makeChangeHandler("basicInfo.playerName")} />
                ) : (
                    <div className="font-semibold">{characterData.basicInfo.playerName}</div>
                )}
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">Razza</Label>
                {editMode ? (
                    <Input value={characterData.basicInfo.race} onChange={makeChangeHandler("basicInfo.race")} />
                ) : (
                    <div className="font-semibold">{characterData.basicInfo.race}</div>
                )}
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">Allineamento</Label>
                {editMode ? (
                    <Input value={characterData.basicInfo.alignment} onChange={makeChangeHandler("basicInfo.alignment")} />
                ) : (
                    <div className="font-semibold">{characterData.basicInfo.alignment}</div>
                )}
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">Punti Esperienza</Label>
                {editMode ? (
                    <Input
                        value={characterData.basicInfo.experiencePoints}
                        onChange={makeChangeHandler("basicInfo.experiencePoints", "int")}
                    />
                ) : (
                    <div className="font-semibold">{characterData.basicInfo.experiencePoints}</div>
                )}
            </div>
        </div>
        <div>
            <Button
                variant="outline"
                size="sm"
                className="mt-4 bg-primary text-white"
                onClick={() => setEditMode(!editMode)}
            >
                {editMode ? "Salva" : "Modifica"}
            </Button>
        </div>
    </div>
);

export default CharacterHeader;