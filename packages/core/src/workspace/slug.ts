const MAX_NAME_LENGTH = 40;

export function toWorkspaceSlug(name: string, suffix: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/g, "");
  return `${base || "workspace"}-${suffix}`;
}
