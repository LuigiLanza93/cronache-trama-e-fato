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

const changelogs = [changelog145, changelog100] as ChangelogEntry[];

export const changelogEntries = changelogs;

export function getChangelogByVersion(version: string) {
  return changelogEntries.find((entry) => entry.version === version) ?? null;
}
