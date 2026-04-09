import { Badge } from "@/components/ui/badge";
import SectionCard from "@/components/characterSheet/section-card";

const Languages = ({ characterData }: any) => (
    <SectionCard cardId="languages" title="Linguaggi">
        <div className="flex flex-wrap gap-1">
            {characterData.proficiencies.languages.map((language: string) => (
                <Badge key={language} variant="outline">
                    {language}
                </Badge>
            ))}
        </div>
    </SectionCard>
);

export default Languages;
