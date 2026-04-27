import { SkillsDashboard } from "@/components/skills-dashboard";
import { hasScannedData, scanClaudeConfig } from "@/lib/scanner";
import staticData from "@/data/skills-data.json";
import type { SkillsData } from "@/types/skills";

export const dynamic = "force-dynamic";

function addDefaultPlatform(data: SkillsData) {
  const addPlatform = (items: SkillsData[keyof SkillsData]) =>
    items.map((item) => ({
      platform: "claude",
      ...item,
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
    : addDefaultPlatform(staticData as SkillsData);

  return <SkillsDashboard data={data} />;
}
