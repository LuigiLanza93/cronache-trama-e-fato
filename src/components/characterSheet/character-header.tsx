import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Pencil, Settings2, X } from "lucide-react";
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

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Impossibile leggere il file."));
                return;
            }
            const [, base64 = ""] = result.split(",");
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("Impossibile leggere il file."));
        reader.readAsDataURL(file);
    });
}

const CharacterHeader = ({
    characterData,
    editMode,
    setEditMode,
}: any) => {
    const [portraitUrl, setPortraitUrl] = useState(characterData.basicInfo.portraitUrl ?? "");
    const [isUploadingPortrait, setIsUploadingPortrait] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [isPortraitOpen, setIsPortraitOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setPortraitUrl(characterData.basicInfo.portraitUrl ?? "");
        setUploadError("");
    }, [characterData.basicInfo.portraitUrl, characterData.slug]);

    const handleCancelEdit = () => {
        setPortraitUrl(characterData.basicInfo.portraitUrl ?? "");
        setUploadError("");
        setEditMode(false);
    };

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
            portraitUrl: portraitUrl.trim(),
        }

        updateCharacter(characterData.slug, { basicInfo: { ...patch } });
        setEditMode(false);
    };

    const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            setUploadError("Usa un file PNG, JPG o WEBP.");
            e.target.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setUploadError("L'immagine deve essere al massimo di 5 MB.");
            e.target.value = "";
            return;
        }

        setIsUploadingPortrait(true);
        setUploadError("");

        try {
            const data = await fileToBase64(file);
            const response = await fetch("/api/uploads/avatar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug: characterData.slug,
                    fileName: file.name,
                    contentType: file.type,
                    data,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.url) {
                throw new Error(payload?.error || "Upload non riuscito.");
            }

            setPortraitUrl(payload.url);
        } catch (error) {
            setUploadError(
                error instanceof Error ? error.message : "Upload non riuscito."
            );
        } finally {
            setIsUploadingPortrait(false);
            e.target.value = "";
        }
    };

    const portraitPreviewUrl = portraitUrl.trim();
    const initials = getInitials(characterData.basicInfo.characterName);

    return (
        <div className="dnd-frame-thick relative p-6">
            <form onSubmit={handleSubmit}>
                <div className="absolute right-4 top-4">
                    {editMode ? (
                        <div className="flex items-center gap-2">
                            <Button
                                type="submit"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
                                aria-label="Salva modifiche"
                                title="Salva modifiche"
                            >
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full"
                                onClick={handleCancelEdit}
                                aria-label="Annulla modifiche"
                                title="Annulla modifiche"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent"
                            onMouseDown={() => setEditMode(true)}
                            aria-label="Modifica intestazione"
                            title="Modifica intestazione"
                        >
                            <Settings2 className="h-4 w-4 text-primary" />
                        </Button>
                    )}
                </div>

                <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:text-left">
                    <div className="relative rounded-[2rem] border-4 border-primary/30 bg-card/80 p-1 shadow-lg">
                        {portraitPreviewUrl && !editMode ? (
                            <button
                                type="button"
                                onClick={() => setIsPortraitOpen(true)}
                                className="block rounded-[1.5rem] transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                aria-label={`Apri il ritratto di ${characterData.basicInfo.characterName}`}
                                title="Apri ritratto"
                            >
                                <Avatar className="h-28 w-28 rounded-[1.5rem] border-2 border-border bg-muted">
                                    <AvatarImage
                                        src={portraitPreviewUrl}
                                        alt={`Ritratto di ${characterData.basicInfo.characterName}`}
                                        className="object-cover"
                                    />
                                    <AvatarFallback className="rounded-[1.25rem] bg-primary/10 font-heading text-3xl font-bold text-primary">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        ) : (
                            <Avatar className="h-28 w-28 rounded-[1.5rem] border-2 border-border bg-muted">
                                {portraitPreviewUrl ? (
                                    <AvatarImage
                                        src={portraitPreviewUrl}
                                        alt={`Ritratto di ${characterData.basicInfo.characterName}`}
                                        className="object-cover"
                                    />
                                ) : null}
                                <AvatarFallback className="rounded-[1.25rem] bg-primary/10 font-heading text-3xl font-bold text-primary">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                        )}
                        {editMode && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handlePortraitUpload}
                                    disabled={isUploadingPortrait}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingPortrait}
                                    className="absolute bottom-1 right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-md transition hover:scale-105 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={isUploadingPortrait ? "Caricamento ritratto" : "Modifica ritratto"}
                                    title={isUploadingPortrait ? "Caricamento..." : "Modifica ritratto"}
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex-1">
                        <h1 className="mb-2 text-4xl font-heading font-bold text-primary">
                            {characterData.basicInfo.characterName}
                        </h1>

                        {editMode && (
                            <div className="mb-4 space-y-2">
                                {isUploadingPortrait && (
                                    <p className="text-xs text-muted-foreground">Caricamento ritratto in corso...</p>
                                )}
                                {uploadError && (
                                    <p className="text-xs text-destructive">{uploadError}</p>
                                )}
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

            </form>

            <Dialog open={isPortraitOpen} onOpenChange={setIsPortraitOpen}>
                <DialogContent className="max-w-3xl border-primary/20 bg-card/95 p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Ritratto di {characterData.basicInfo.characterName}</DialogTitle>
                    </DialogHeader>
                    {portraitPreviewUrl && (
                        <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
                            <img
                                src={portraitPreviewUrl}
                                alt={`Ritratto di ${characterData.basicInfo.characterName}`}
                                className="max-h-[75vh] w-full object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CharacterHeader;
