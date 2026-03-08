export interface SkillItem {
  name: string;
  displayName: string;
  type: "agent" | "skill" | "command" | "plugin" | "hook";
  description: string;
  model: string | null;
  domain?: string;
  source: "project" | "global" | "built-in";
  tools: string[];
  keywords?: string[];
  filePath?: string;
}

export interface SkillsData {
  agents: SkillItem[];
  skills: SkillItem[];
  commands: SkillItem[];
  plugins: SkillItem[];
  hooks: SkillItem[];
}

export type Category = "all" | "agent" | "skill" | "command" | "plugin" | "hook";
