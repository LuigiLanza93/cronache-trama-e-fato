import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sword, Users, Map, Scroll, Dice6 } from "lucide-react";

interface Campaign {
  campaignInfo: {
    name: string;
    dm: string;
    session: number;
    location: string;
    date: string;
  };
  activePlayers: Array<{
    name: string;
    slug: string;
    class: string;
    level: number;
    player: string;
    status: string;
  }>;
  notes: string[];
}

interface Monster {
  name: string;
  challengeRating: string;
  armorClass: number;
  hitPoints: number;
  type: string;
  size: string;
}

const DMDashboard = () => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [monsters] = useState<Monster[]>([
    {
      name: "Goblin",
      challengeRating: "1/4",
      armorClass: 15,
      hitPoints: 7,
      type: "humanoid",
      size: "Small"
    }
  ]);
  const [sessionNotes, setSessionNotes] = useState("");

  useEffect(() => {
    // In a real app, this would be an API call
    import("@/data/campaign.json").then((data) => {
      setCampaign(data.default);
    });
  }, []);

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-heading text-primary">Loading Campaign...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen parchment p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-heading font-bold text-primary">
            Dungeon Master's Screen
          </h1>
          <div className="dnd-frame p-4">
            <h2 className="text-2xl font-heading text-crimson">{campaign.campaignInfo.name}</h2>
            <div className="flex justify-center items-center gap-6 mt-2 text-sm text-muted-foreground">
              <span>Session {campaign.campaignInfo.session}</span>
              <span>•</span>
              <span>{campaign.campaignInfo.location}</span>
              <span>•</span>
              <span>{campaign.campaignInfo.date}</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 dnd-frame">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="players" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Players
            </TabsTrigger>
            <TabsTrigger value="bestiary" className="flex items-center gap-2">
              <Sword className="w-4 h-4" />
              Bestiary
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <Scroll className="w-4 h-4" />
              Session Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="character-section">
                <div className="character-section-title">Campaign Status</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Active Players:</span>
                    <Badge variant="secondary">{campaign.activePlayers.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Location:</span>
                    <span className="text-primary font-semibold">{campaign.campaignInfo.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session:</span>
                    <span className="text-primary font-semibold">#{campaign.campaignInfo.session}</span>
                  </div>
                </div>
              </Card>

              <Card className="character-section">
                <div className="character-section-title">Quick Actions</div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Dice6 className="w-4 h-4 mr-2" />
                    Roll Initiative
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Sword className="w-4 h-4 mr-2" />
                    Start Encounter
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Scroll className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </Card>

              <Card className="character-section">
                <div className="character-section-title">Recent Notes</div>
                <div className="space-y-1 text-sm">
                  {campaign.notes.slice(-3).map((note, index) => (
                    <div key={index} className="text-muted-foreground">
                      • {note}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-4">
            <div className="grid gap-4">
              {campaign.activePlayers.map((player) => (
                <Card key={player.slug} className="character-section">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-primary">
                        {player.name}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {player.class} Level {player.level} • Played by {player.player}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={player.status === 'active' ? 'default' : 'secondary'}>
                        {player.status}
                      </Badge>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/${player.slug}`}>View Sheet</a>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bestiary" className="space-y-4">
            <div className="grid gap-4">
              {monsters.map((monster, index) => (
                <Card key={index} className="character-section">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-primary">
                        {monster.name}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {monster.size} {monster.type} • CR {monster.challengeRating}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div>AC {monster.armorClass}</div>
                      <div>{monster.hitPoints} HP</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <Card className="character-section">
              <div className="character-section-title">Session Notes</div>
              <Textarea
                placeholder="Record important events, player decisions, and story developments..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="min-h-48"
              />
              <Button className="mt-2">Save Notes</Button>
            </Card>
            
            <Card className="character-section">
              <div className="character-section-title">Previous Notes</div>
              <div className="space-y-2">
                {campaign.notes.map((note, index) => (
                  <div key={index} className="text-sm border-l-2 border-primary pl-3 py-1">
                    {note}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DMDashboard;