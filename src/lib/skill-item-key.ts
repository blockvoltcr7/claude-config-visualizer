import type { SkillItem } from "@/types/skills";

export function getSkillItemStableKey(item: SkillItem): string {
  if (item.type === "plugin") {
    const pluginIdentity = item.pluginId ?? `${item.name}@${item.domain ?? "unknown"}`;
    return `${item.platform}::${pluginIdentity}::plugin`;
  }

  if (item.pluginId) {
    return `${item.platform}::${item.pluginId}::${item.name}::${item.type}`;
  }

  return `${item.platform}::${item.name}::${item.type}`;
}
