import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { Platform, SkillItem } from "@/types/skills";

export async function parseSkills(
  dir: string,
  source: "global" | "project",
  platform: Platform = "claude"
): Promise<SkillItem[]> {
  const skillsDir = path.join(dir, "skills");

  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }

  const items: SkillItem[] = [];

  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);
    const stat = await fs.stat(entryPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    // Look for skill.md or SKILL.md (case-insensitive)
    let skillFile: string | null = null;
    try {
      const dirFiles = await fs.readdir(entryPath);
      skillFile =
        dirFiles.find((f) => f.toLowerCase() === "skill.md") ?? null;
    } catch {
      continue;
    }

    if (!skillFile) continue;

    try {
      const raw = await fs.readFile(path.join(entryPath, skillFile), "utf-8");
      const { data } = matter(raw);

      const name = data.name ?? entry;
      const toolsRaw = data["allowed-tools"] ?? data.tools;
      let tools: string[] = [];
      if (typeof toolsRaw === "string") {
        tools = toolsRaw.split(",").map((t: string) => t.trim()).filter(Boolean);
      } else if (Array.isArray(toolsRaw)) {
        tools = toolsRaw;
      }

      items.push({
        name,
        displayName:
          name
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        platform,
        type: "skill",
        description: typeof data.description === "string" ? data.description : "",
        model: typeof data.model === "string" ? data.model : null,
        domain: "",
        source,
        tools,
        keywords: [],
        filePath: path.join(entryPath, skillFile),
      });
    } catch {
      // skip malformed files
    }
  }

  return items;
}
