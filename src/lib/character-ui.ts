export function getInitials(name: string | undefined) {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function normalizePortraitUrl(url: string | undefined) {
  const normalized = (url ?? "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("public/")) return `/${normalized.slice("public/".length)}`;
  return normalized;
}
