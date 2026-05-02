import os from "os";
import path from "path";
import { parseAgents } from "./parse-agents";
import { parseSkills } from "./parse-skills";
import { parseCommands } from "./parse-commands";
import { parseHooks } from "./parse-hooks";
import { parsePluginInventory } from "./parse-plugins";
import { getSkillItemStableKey } from "@/lib/skill-item-key";
import type { Platform, SkillsData, SkillItem } from "@/types/skills";

function deduplicate(items: SkillItem[]): SkillItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getSkillItemStableKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function annotatePluginItems(items: SkillItem[], plugin: SkillItem): SkillItem[] {
  return items.map((item) => ({
    ...item,
    platform: plugin.platform,
    pluginId: plugin.pluginId,
    pluginDisplayName: plugin.displayName,
    pluginVersion: plugin.version,
  }));
}

async function scanEnabledPluginBundles(pluginInventory: Awaited<ReturnType<typeof parsePluginInventory>>) {
  const pluginsById = new Map(
    pluginInventory.items
      .filter((item): item is SkillItem & { pluginId: string } => typeof item.pluginId === "string")
      .map((item) => [item.pluginId, item])
  );

  const bundleScans = await Promise.all(
    Array.from(pluginInventory.enabledPlugins.entries()).map(async ([pluginId, config]) => {
      if (!config.enabled) {
        return null;
      }

      const installed = pluginInventory.installedPlugins.get(pluginId);
      const plugin = pluginsById.get(pluginId);
      if (!installed || !plugin) {
        return null;
      }

      const [agents, skills, commands, hooks] = await Promise.all([
        parseAgents(installed.releasePath, config.source, plugin.platform),
        parseSkills(installed.releasePath, config.source, plugin.platform),
        parseCommands(installed.releasePath, config.source, plugin.platform),
        parseHooks(installed.releasePath, config.source, plugin.platform),
      ]);

      return {
        agents: annotatePluginItems(agents, plugin),
        skills: annotatePluginItems(skills, plugin),
        commands: annotatePluginItems(commands, plugin),
        hooks: annotatePluginItems(hooks, plugin),
      };
    })
  );

  return bundleScans.filter(Boolean) as Array<Omit<SkillsData, "plugins">>;
}

export function hasScannedData(scanned: SkillsData): boolean {
  return (
    scanned.agents.length > 0 ||
    scanned.skills.length > 0 ||
    scanned.commands.length > 0 ||
    scanned.plugins.length > 0 ||
    scanned.hooks.length > 0
  );
}

export async function scanClaudeConfigFromDirs(
  globalDir: string,
  projectDir: string
): Promise<SkillsData> {
  return scanConfigFromDirs(globalDir, projectDir, "claude");
}

export async function scanCodexConfigFromDirs(
  globalDir: string,
  projectDir: string
): Promise<SkillsData> {
  return scanConfigFromDirs(globalDir, projectDir, "codex");
}

async function scanConfigFromDirs(
  globalDir: string,
  projectDir: string,
  platform: Platform
): Promise<SkillsData> {
  try {
    const [agents, skills, commands, pluginInventory, hooks] = await Promise.all([
      parseAgents(globalDir, "global", platform),
      parseSkills(globalDir, "global", platform),
      parseCommands(globalDir, "global", platform),
      parsePluginInventory(globalDir, projectDir, platform),
      parseHooks(globalDir, "global", platform),
    ]);
    const pluginBundles = await scanEnabledPluginBundles(pluginInventory);

    return {
      agents: deduplicate([
        ...agents,
        ...pluginBundles.flatMap((bundle) => bundle.agents),
      ]),
      skills: deduplicate([
        ...skills,
        ...pluginBundles.flatMap((bundle) => bundle.skills),
      ]),
      commands: deduplicate([
        ...commands,
        ...pluginBundles.flatMap((bundle) => bundle.commands),
      ]),
      plugins: deduplicate(pluginInventory.items),
      hooks: deduplicate([
        ...hooks,
        ...pluginBundles.flatMap((bundle) => bundle.hooks),
      ]),
    };
  } catch {
    return { agents: [], skills: [], commands: [], plugins: [], hooks: [] };
  }
}

export async function scanClaudeConfig(): Promise<SkillsData> {
  const claudeGlobal = path.join(os.homedir(), ".claude");
  const claudeProject = path.join(process.cwd(), ".claude");
  const codexGlobal = path.join(os.homedir(), ".codex");
  const codexProject = path.join(process.cwd(), ".codex");

  const [claude, codex] = await Promise.all([
    scanConfigFromDirs(claudeGlobal, claudeProject, "claude"),
    scanConfigFromDirs(codexGlobal, codexProject, "codex"),
  ]);

  return {
    agents: deduplicate([...claude.agents, ...codex.agents]),
    skills: deduplicate([...claude.skills, ...codex.skills]),
    commands: deduplicate([...claude.commands, ...codex.commands]),
    plugins: deduplicate([...claude.plugins, ...codex.plugins]),
    hooks: deduplicate([...claude.hooks, ...codex.hooks]),
  };
}
