import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { Platform, SkillItem } from "@/types/skills";

export async function parseAgents(
  dir: string,
  source: "global" | "project",
  platform: Platform = "claude"
): Promise<SkillItem[]> {
  const agentsDir = path.join(dir, "agents");

  let files: string[];
  try {
    files = await fs.readdir(agentsDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const items: SkillItem[] = [];

  for (const file of mdFiles) {
    try {
      const raw = await fs.readFile(path.join(agentsDir, file), "utf-8");
      const { data } = matter(raw);

      const name = data.name ?? file.replace(/\.md$/, "");
      items.push({
        name,
        displayName:
          name
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        platform,
        type: "agent",
        description: typeof data.description === "string" ? data.description : "",
        model: typeof data.model === "string" ? data.model : null,
        domain: "",
        source,
        tools: Array.isArray(data.tools) ? data.tools : [],
        keywords: [],
        filePath: path.join(agentsDir, file),
      });
    } catch {
      // skip malformed files
    }
  }

  return items;
}
