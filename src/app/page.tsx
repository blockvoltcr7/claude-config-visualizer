import { SkillsDashboard } from "@/components/skills-dashboard";
import { scanClaudeConfig } from "@/lib/scanner";
import staticData from "@/data/skills-data.json";
import type { SkillsData } from "@/types/skills";

export const dynamic = "force-dynamic";

export default async function Home() {
  const scanned = await scanClaudeConfig();

  const hasData =
    scanned.agents.length > 0 ||
    scanned.skills.length > 0 ||
    scanned.commands.length > 0 ||
    scanned.hooks.length > 0;

  const data: SkillsData = hasData ? scanned : (staticData as SkillsData);

  return <SkillsDashboard data={data} />;
}
