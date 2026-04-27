import fs from "fs/promises";
import path from "path";
import type { Platform, SkillItem } from "@/types/skills";

export async function parseCommands(
  dir: string,
  source: "global" | "project",
  platform: Platform = "claude"
): Promise<SkillItem[]> {
  const commandsDir = path.join(dir, "commands");

  let files: string[];
  try {
    files = await fs.readdir(commandsDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const items: SkillItem[] = [];

  for (const file of mdFiles) {
    try {
      const raw = await fs.readFile(path.join(commandsDir, file), "utf-8");
      const name = file.replace(/\.md$/, "");

      // Extract H1 title
      const h1Match = raw.match(/^#\s+(.+)$/m);
      const displayName = h1Match?.[1]?.trim() ?? name;

      // Extract first paragraph or blockquote as description
      const lines = raw.split("\n");
      let description = "";
      let foundContent = false;

      for (const line of lines) {
        // Skip the H1 line and empty lines before content
        if (!foundContent) {
          if (line.startsWith("# ") || line.trim() === "" || line.startsWith("---")) continue;
          foundContent = true;
        }

        if (foundContent) {
          const trimmed = line.trim();
          if (trimmed === "") break; // end of first paragraph
          // Strip blockquote markers
          description += (description ? " " : "") + trimmed.replace(/^>\s*/, "");
        }
      }

      items.push({
        name,
        displayName,
        platform,
        type: "command",
        description,
        model: null,
        domain: "",
        source,
        tools: [],
        keywords: [],
        filePath: path.join(commandsDir, file),
      });
    } catch {
      // skip malformed files
    }
  }

  return items;
}
