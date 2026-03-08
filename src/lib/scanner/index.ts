import os from "os";
import path from "path";
import { parseAgents } from "./parse-agents";
import { parseSkills } from "./parse-skills";
import { parseCommands } from "./parse-commands";
import { parseHooks } from "./parse-hooks";
import { parsePlugins } from "./parse-plugins";
import type { SkillsData, SkillItem } from "@/types/skills";

function deduplicate(items: SkillItem[]): SkillItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const itemIdentity =
      item.type === "plugin"
        ? item.pluginId ?? `${item.name}@${item.domain ?? "unknown"}`
        : item.name;
    const key = `${itemIdentity}::${item.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function scanClaudeConfig(): Promise<SkillsData> {
  const globalDir = path.join(os.homedir(), ".claude");
  const projectDir = path.join(process.cwd(), ".claude");

  try {
    const [agents, skills, commands, plugins, hooks] = await Promise.all([
      parseAgents(globalDir, "global"),
      parseSkills(globalDir, "global"),
      parseCommands(globalDir, "global"),
      parsePlugins(globalDir, projectDir),
      parseHooks(globalDir, "global"),
    ]);

    return {
      agents: deduplicate(agents),
      skills: deduplicate(skills),
      commands: deduplicate(commands),
      plugins: deduplicate(plugins),
      hooks: deduplicate(hooks),
    };
  } catch {
    return { agents: [], skills: [], commands: [], plugins: [], hooks: [] };
  }
}
