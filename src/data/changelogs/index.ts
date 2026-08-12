import changelog172 from "./1.7.2-slot-conversion-and-safe-imports.json";
import changelog171 from "./1.7.1-shops-and-trading.json";
import changelog160 from "./1.6.0-campaign-memory.json";
import changelog150 from "./1.5.0-chat-foundations.json";
import changelog149 from "./1.4.9-cumulative-player-dm.json";
import changelog100 from "./1.0.0-sqlite-release.json";
import changelog145 from "./1.4.5-home-login-refinement.json";

export type ChangelogSection = {
  title: string;
  items: string[];
};

export type ChangelogEntry = {
  version: string;
  releaseName: string;
  releasedAt?: string;
  summary?: string;
  sections: ChangelogSection[];
};

const changelogs = [changelog172, changelog171, changelog160, changelog150, changelog149, changelog145, changelog100] as ChangelogEntry[];

export const changelogEntries = changelogs;

export function getChangelogByVersion(version: string) {
  return changelogEntries.find((entry) => entry.version === version) ?? null;
}
