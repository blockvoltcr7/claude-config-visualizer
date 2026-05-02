export type Platform = "claude" | "codex";

export interface PluginCounts {
  skills: number;
  commands: number;
  agents: number;
  hooks: number;
}

export interface SkillItem {
  name: string;
  displayName: string;
  platform: Platform;
  type: "agent" | "skill" | "command" | "plugin" | "hook";
  description: string;
  model: string | null;
  domain?: string;
  source: "project" | "global" | "built-in";
  tools: string[];
  keywords?: string[];
  filePath?: string;
  status?: "enabled" | "disabled";
  version?: string;
  pluginId?: string;
  pluginDisplayName?: string;
  pluginVersion?: string;
  pluginCounts?: PluginCounts;
}

export interface SkillsData {
  agents: SkillItem[];
  skills: SkillItem[];
  commands: SkillItem[];
  plugins: SkillItem[];
  hooks: SkillItem[];
}

export type Category = "all" | "agent" | "skill" | "command" | "plugin" | "hook";
