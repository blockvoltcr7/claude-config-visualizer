import os from "os";
import path from "path";
import { parseAgents } from "./parse-agents";
import { parseSkills } from "./parse-skills";
import { parseCommands } from "./parse-commands";
import { parseHooks } from "./parse-hooks";
import type { SkillsData, SkillItem } from "@/types/skills";

function deduplicate(items: SkillItem[]): SkillItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}::${item.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function scanClaudeConfig(): Promise<SkillsData> {
  const globalDir = path.join(os.homedir(), ".claude");
  const projectDir = path.join(process.cwd(), ".claude");

  try {
    const [
      globalAgents,
      projectAgents,
      globalSkills,
      projectSkills,
      globalCommands,
      projectCommands,
      globalHooks,
      projectHooks,
    ] = await Promise.all([
      parseAgents(globalDir, "global"),
      parseAgents(projectDir, "project"),
      parseSkills(globalDir, "global"),
      parseSkills(projectDir, "project"),
      parseCommands(globalDir, "global"),
      parseCommands(projectDir, "project"),
      parseHooks(globalDir, "global"),
      parseHooks(projectDir, "project"),
    ]);

    return {
      agents: deduplicate([...projectAgents, ...globalAgents]),
      skills: deduplicate([...projectSkills, ...globalSkills]),
      commands: deduplicate([...projectCommands, ...globalCommands]),
      plugins: [], // excluded from scope
      hooks: deduplicate([...projectHooks, ...globalHooks]),
    };
  } catch {
    return { agents: [], skills: [], commands: [], plugins: [], hooks: [] };
  }
}
