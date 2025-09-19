import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Languages = ({ characterData }: any) => (
    <Card className="character-section">
        <div className="character-section-title">Linguaggi</div>
        <div className="flex flex-wrap gap-1">
            {characterData.proficiencies.languages.map((language: string) => (
                <Badge key={language} variant="outline">
                    {language}
                </Badge>
            ))}
        </div>
    </Card>
);

export default Languages;