import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateCharacter } from "@/realtime";

function getInitials(name: string | undefined) {
    return (name ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "?";
}

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
            portraitUrl: (formData.get("portraitUrl") as string)?.trim() || "",
        }

        updateCharacter(characterData.slug, { basicInfo: { ...patch } });
        setEditMode(false);
    };

    const portraitUrl = characterData.basicInfo.portraitUrl?.trim();
    const initials = getInitials(characterData.basicInfo.characterName);

    return (
        <div className="dnd-frame-thick p-6">
            <form onSubmit={handleSubmit}>
                <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:text-left">
                    <div className="rounded-[2rem] border-4 border-primary/30 bg-card/80 p-1 shadow-lg">
                        <Avatar className="h-28 w-28 rounded-[1.5rem] border-2 border-border bg-muted">
                            {portraitUrl ? (
                                <AvatarImage
                                    src={portraitUrl}
                                    alt={`Ritratto di ${characterData.basicInfo.characterName}`}
                                    className="object-cover"
                                />
                            ) : null}
                            <AvatarFallback className="rounded-[1.25rem] bg-primary/10 font-heading text-3xl font-bold text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="flex-1">
                        <h1 className="mb-2 text-4xl font-heading font-bold text-primary">
                            {characterData.basicInfo.characterName}
                        </h1>

                        {editMode && (
                            <div className="mb-4 space-y-2">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Ritratto</Label>
                                    <Input
                                        name="portraitUrl"
                                        defaultValue={characterData.basicInfo.portraitUrl}
                                        placeholder="https://... oppure /portraits/nome-personaggio.png"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Puoi usare un link esterno oppure un file dentro <span className="font-mono">public/portraits</span>.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
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
                    </div>
                </div>

                <div className="text-center md:text-left">
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
