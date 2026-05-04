import { SkillsDashboard } from "@/components/skills-dashboard";
import { hasScannedData, scanClaudeConfig } from "@/lib/scanner";
import staticData from "@/data/skills-data.json";
import type { SkillItem, SkillsData } from "@/types/skills";

export const dynamic = "force-dynamic";

type MaybePlatformSkillItem = Omit<SkillItem, "platform"> & {
  platform?: SkillItem["platform"];
};

type MaybePlatformSkillsData = {
  [K in keyof SkillsData]: MaybePlatformSkillItem[];
};

function addDefaultPlatform(data: MaybePlatformSkillsData): SkillsData {
  const addPlatform = (items: MaybePlatformSkillItem[]): SkillItem[] =>
    items.map((item) => ({
      ...item,
      platform: item.platform ?? "claude",
    }));

  return {
    agents: addPlatform(data.agents),
    skills: addPlatform(data.skills),
    commands: addPlatform(data.commands),
    plugins: addPlatform(data.plugins),
    hooks: addPlatform(data.hooks),
  };
}

export default async function Home() {
  const scanned = await scanClaudeConfig();
  const normalizedScanned = addDefaultPlatform(scanned);
  const data: SkillsData = hasScannedData(normalizedScanned)
    ? normalizedScanned
    : addDefaultPlatform(staticData as unknown as MaybePlatformSkillsData);

  return <SkillsDashboard data={data} />;
}
