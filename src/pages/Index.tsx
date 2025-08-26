import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Users, Scroll, Sword, Dice6 } from "lucide-react";

const Index = () => {
  const availableCharacters = [
    { name: "Gigi Thunderstrike", slug: "gigi", class: "Barbarian", level: 3 }
  ];

  return (
    <div className="min-h-screen parchment">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 to-transparent"></div>
        <div className="relative max-w-4xl mx-auto text-center py-20 px-6">
          <h1 className="text-6xl font-heading font-bold text-primary mb-6">
            D&D Character Manager
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your digital companion for Dungeons & Dragons adventures. 
            Manage character sheets, track campaigns, and enhance your tabletop experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <a href="/dm">
                <Shield className="w-5 h-5 mr-2" />
                DM Dashboard
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/gigi">
                <Scroll className="w-5 h-5 mr-2" />
                View Character Sheet
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto py-16 px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-heading font-bold text-primary mb-4">
            Everything You Need for Your Campaign
          </h2>
          <Separator className="w-24 mx-auto bg-primary" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="character-section text-center">
            <Users className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="character-section-title text-center border-0 pb-0">Character Management</h3>
            <p className="text-muted-foreground">
              Create and manage detailed character sheets with full D&D 5e compatibility. 
              Track stats, equipment, and progression.
            </p>
          </Card>

          <Card className="character-section text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="character-section-title text-center border-0 pb-0">DM Tools</h3>
            <p className="text-muted-foreground">
              Comprehensive dungeon master dashboard with encounter tracking, 
              bestiary, and campaign notes.
            </p>
          </Card>

          <Card className="character-section text-center">
            <Dice6 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="character-section-title text-center border-0 pb-0">Real-time Updates</h3>
            <p className="text-muted-foreground">
              Live synchronization between players and DM. 
              See character changes and campaign updates instantly.
            </p>
          </Card>
        </div>
      </div>

      {/* Available Characters */}
      <div className="max-w-4xl mx-auto py-16 px-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-heading font-bold text-primary mb-4">
            Available Characters
          </h2>
          <Separator className="w-24 mx-auto bg-primary" />
        </div>

        <div className="grid gap-4">
          {availableCharacters.map((character) => (
            <Card key={character.slug} className="character-section">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-heading font-semibold text-primary">
                    {character.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{character.class}</Badge>
                    <Badge variant="outline">Level {character.level}</Badge>
                  </div>
                </div>
                <Button asChild>
                  <a href={`/${character.slug}`}>
                    <Scroll className="w-4 h-4 mr-2" />
                    View Sheet
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-muted-foreground mb-4">
            Want to add a new character? Create a JSON file in the data/characters/ directory.
          </p>
          <Button variant="outline" asChild>
            <a href="/dm">
              <Shield className="w-4 h-4 mr-2" />
              Go to DM Dashboard
            </a>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-16">
        <div className="max-w-4xl mx-auto py-8 px-6 text-center">
          <p className="text-muted-foreground">
            Built for D&D 5e enthusiasts. May your rolls be high and your adventures legendary.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
