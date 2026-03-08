import fs from "fs/promises";
import path from "path";
import type { SkillItem } from "@/types/skills";

type ScanSource = "global" | "project";

interface EnabledPluginConfig {
  enabled: boolean;
  source: ScanSource;
  filePath: string;
}

interface InstalledPluginMeta {
  pluginId: string;
  name: string;
  marketplace: string;
  description: string;
  version?: string;
  keywords: string[];
  filePath?: string;
  mtimeMs: number;
}

interface PluginIdentity {
  pluginId: string;
  name: string;
  marketplace: string;
}

function toDisplayName(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function parsePluginIdentity(value: string): PluginIdentity {
  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) {
    const name = value.trim();
    return {
      pluginId: `${name}@unknown`,
      name,
      marketplace: "unknown",
    };
  }

  const name = value.slice(0, atIndex).trim();
  const marketplace = value.slice(atIndex + 1).trim();

  return {
    pluginId: `${name}@${marketplace}`,
    name,
    marketplace,
  };
}

function parseReadmeDescription(raw: string): string {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  let paragraph = "";

  for (const line of lines) {
    if (!line) {
      if (paragraph) break;
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    paragraph += `${paragraph ? " " : ""}${line.replace(/^>\s*/, "")}`;

    if (paragraph.length >= 220) {
      break;
    }
  }

  return paragraph.slice(0, 220).trim();
}

function parseVersion(value: unknown, releaseDir: string): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (/^v?\d+\.\d+\.\d+([-\w.]*)?$/.test(releaseDir)) {
    return releaseDir;
  }

  return undefined;
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readInstalledPluginCandidate(
  releasePath: string,
  pluginName: string,
  marketplace: string,
  releaseDir: string
): Promise<InstalledPluginMeta | null> {
  const pluginJsonPath = path.join(releasePath, ".claude-plugin", "plugin.json");
  const readmePath = path.join(releasePath, "README.md");
  const stat = await fs.stat(releasePath).catch(() => null);
  if (!stat?.isDirectory()) {
    return null;
  }

  const pluginJson = await readJsonFile(pluginJsonPath);
  const readmeRaw = await fs.readFile(readmePath, "utf-8").catch(() => "");
  const readmeDescription = readmeRaw ? parseReadmeDescription(readmeRaw) : "";

  const description =
    (typeof pluginJson?.description === "string" && pluginJson.description.trim()) ||
    readmeDescription ||
    `${toDisplayName(pluginName)} plugin`;

  const keywords = Array.isArray(pluginJson?.keywords)
    ? pluginJson.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];

  const filePath = pluginJson ? pluginJsonPath : readmeRaw ? readmePath : undefined;
  if (!filePath) {
    return null;
  }

  const pluginId = `${pluginName}@${marketplace}`;

  return {
    pluginId,
    name: pluginName,
    marketplace,
    description,
    version: parseVersion(pluginJson?.version, releaseDir),
    keywords,
    filePath,
    mtimeMs: stat.mtimeMs,
  };
}

async function parseEnabledPlugins(
  globalDir: string,
  projectDir: string
): Promise<Map<string, EnabledPluginConfig>> {
  const precedenceFiles: Array<{ filePath: string; source: ScanSource }> = [
    { filePath: path.join(globalDir, "settings.json"), source: "global" },
    { filePath: path.join(globalDir, "settings.local.json"), source: "global" },
    { filePath: path.join(projectDir, "settings.json"), source: "project" },
    { filePath: path.join(projectDir, "settings.local.json"), source: "project" },
  ];

  const enabledPlugins = new Map<string, EnabledPluginConfig>();

  for (const file of precedenceFiles) {
    const parsed = await readJsonFile(file.filePath);
    if (!parsed) continue;

    const enabledRaw = parsed.enabledPlugins;
    if (!enabledRaw || typeof enabledRaw !== "object" || Array.isArray(enabledRaw)) {
      continue;
    }

    for (const [rawPluginId, rawEnabled] of Object.entries(enabledRaw)) {
      if (typeof rawEnabled !== "boolean") continue;

      const identity = parsePluginIdentity(rawPluginId);
      enabledPlugins.set(identity.pluginId, {
        enabled: rawEnabled,
        source: file.source,
        filePath: file.filePath,
      });
    }
  }

  return enabledPlugins;
}

async function parseInstalledPlugins(globalDir: string): Promise<Map<string, InstalledPluginMeta>> {
  const cacheDir = path.join(globalDir, "plugins", "cache");
  let marketplaces: string[];

  try {
    marketplaces = await fs.readdir(cacheDir);
  } catch {
    return new Map<string, InstalledPluginMeta>();
  }

  const installed = new Map<string, InstalledPluginMeta>();

  for (const marketplace of marketplaces) {
    const marketplacePath = path.join(cacheDir, marketplace);
    const marketplaceStat = await fs.stat(marketplacePath).catch(() => null);
    if (!marketplaceStat?.isDirectory()) continue;

    const pluginDirs = await fs.readdir(marketplacePath).catch(() => []);
    for (const pluginName of pluginDirs) {
      const pluginPath = path.join(marketplacePath, pluginName);
      const pluginStat = await fs.stat(pluginPath).catch(() => null);
      if (!pluginStat?.isDirectory()) continue;

      const releaseDirs = await fs.readdir(pluginPath).catch(() => []);
      let best: InstalledPluginMeta | null = null;

      for (const releaseDir of releaseDirs) {
        const releasePath = path.join(pluginPath, releaseDir);
        const candidate = await readInstalledPluginCandidate(
          releasePath,
          pluginName,
          marketplace,
          releaseDir
        );
        if (!candidate) continue;

        if (!best || candidate.mtimeMs > best.mtimeMs) {
          best = candidate;
        }
      }

      if (best) {
        installed.set(best.pluginId, best);
      }
    }
  }

  return installed;
}

export async function parsePlugins(
  globalDir: string,
  projectDir: string
): Promise<SkillItem[]> {
  const [enabledPlugins, installedPlugins] = await Promise.all([
    parseEnabledPlugins(globalDir, projectDir),
    parseInstalledPlugins(globalDir),
  ]);

  const pluginIds = new Set([
    ...enabledPlugins.keys(),
    ...installedPlugins.keys(),
  ]);

  const items: SkillItem[] = [];

  for (const pluginId of pluginIds) {
    const enabledConfig = enabledPlugins.get(pluginId);
    const installed = installedPlugins.get(pluginId);
    const identity = parsePluginIdentity(pluginId);
    const status: SkillItem["status"] = enabledConfig?.enabled ? "enabled" : "disabled";
    const version = installed?.version;

    items.push({
      name: identity.name,
      displayName: toDisplayName(identity.name),
      type: "plugin",
      description:
        installed?.description || `${toDisplayName(identity.name)} plugin`,
      model: null,
      domain: identity.marketplace,
      source: enabledConfig?.source ?? "global",
      tools: [],
      keywords: [...new Set([
        ...(installed?.keywords ?? []),
        identity.marketplace,
        status,
        ...(version ? [`v${version}`] : []),
      ])],
      filePath: installed?.filePath ?? enabledConfig?.filePath,
      status,
      version,
      pluginId: identity.pluginId,
    });
  }

  return items.sort((a, b) => {
    const aStatus = a.status === "enabled" ? 0 : 1;
    const bStatus = b.status === "enabled" ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;

    return a.displayName.localeCompare(b.displayName);
  });
}
