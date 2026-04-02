import MonsterCompendiumSheet from "@/components/characterSheet/monster-compendium-sheet";

export default function PlayerMonsterCompendium() {
  return (
    <div className="min-h-screen parchment p-6">
      <div className="mx-auto max-w-[1400px] rounded-[1.75rem] border border-border/60 bg-card/20 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <MonsterCompendiumSheet mode="page" />
      </div>
    </div>
  );
}
