import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateCharacter } from "@/realtime";

const CharacterHeader = ({
    characterData,
    editMode,
    setEditMode,
}: any) => {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const patch = {
            characterName: characterData.basicInfo.characterName,
            class: formData.get("class") as string,
            level: parseInt(formData.get("level") as string, 10) || 1,
            background: formData.get("background") as string,
            playerName: formData.get("playerName") as string,
            race: formData.get("race") as string,
            alignment: formData.get("alignment") as string,
            experiencePoints: parseInt(formData.get("experiencePoints") as string, 10) || 0,
        }

        updateCharacter(characterData.slug, { basicInfo: { ...patch } });
        setEditMode(false);
    };

    return (
        <div className="dnd-frame-thick p-6 text-center">
            <form onSubmit={handleSubmit}>
                <h1 className="text-4xl font-heading font-bold text-primary mb-2">
                    {characterData.basicInfo.characterName}
                </h1>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="grid grid-cols-2">
                        <div>
                            <Label className="text-xs text-muted-foreground">Classe</Label>
                            {editMode ? (
                                <Input
                                    name="class"
                                    defaultValue={characterData.basicInfo.class}
                                />
                            ) : (
                                <div className="font-semibold">
                                    {characterData.basicInfo.class}
                                </div>
                            )}
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Livello</Label>
                            {editMode ? (
                                <Input
                                    name="level"
                                    type="number"
                                    defaultValue={characterData.basicInfo.level}
                                />
                            ) : (
                                <div className="font-semibold">
                                    {characterData.basicInfo.level}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Background</Label>
                        {editMode ? (
                            <Input
                                name="background"
                                defaultValue={characterData.basicInfo.background}
                            />
                        ) : (
                            <div className="font-semibold">
                                {characterData.basicInfo.background}
                            </div>
                        )}
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Nome giocatore</Label>
                        {editMode ? (
                            <Input
                                name="playerName"
                                defaultValue={characterData.basicInfo.playerName}
                            />
                        ) : (
                            <div className="font-semibold">
                                {characterData.basicInfo.playerName}
                            </div>
                        )}
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Razza</Label>
                        {editMode ? (
                            <Input
                                name="race"
                                defaultValue={characterData.basicInfo.race}
                            />
                        ) : (
                            <div className="font-semibold">
                                {characterData.basicInfo.race}
                            </div>
                        )}
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Allineamento</Label>
                        {editMode ? (
                            <Input
                                name="alignment"
                                defaultValue={characterData.basicInfo.alignment}
                            />
                        ) : (
                            <div className="font-semibold">
                                {characterData.basicInfo.alignment}
                            </div>
                        )}
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Punti Esperienza</Label>
                        {editMode ? (
                            <Input
                                name="experiencePoints"
                                type="number"
                                defaultValue={characterData.basicInfo.experiencePoints}
                            />
                        ) : (
                            <div className="font-semibold">
                                {characterData.basicInfo.experiencePoints}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    {editMode ? (
                        <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="mt-4 bg-primary text-white"
                        // niente onClick, ci pensa il submit
                        >
                            Salva
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4 bg-primary text-white"
                            onMouseDown={() => setEditMode(true)} // switcha PRIMA del click
                        >
                            Modifica
                        </Button>
                    )}
                </div>

            </form>
        </div>
    );
};

export default CharacterHeader;
