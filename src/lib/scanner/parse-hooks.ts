import fs from "fs/promises";
import path from "path";
import type { SkillItem } from "@/types/skills";

interface HookEntry {
  matcher?: string;
  hooks?: Array<{
    type?: string;
    command?: string;
    prompt?: string;
    timeout?: number;
  }>;
}

export async function parseHooks(
  dir: string,
  source: "global" | "project"
): Promise<SkillItem[]> {
  const hooksPath = path.join(dir, "hooks", "hooks.json");

  let raw: string;
  try {
    raw = await fs.readFile(hooksPath, "utf-8");
  } catch {
    return [];
  }

  let hooksData: Record<string, HookEntry[]>;
  try {
    hooksData = JSON.parse(raw);
  } catch {
    return [];
  }

  const items: SkillItem[] = [];

  for (const [eventName, entries] of Object.entries(hooksData)) {
    if (!Array.isArray(entries)) continue;

    const hookTypes = entries
      .flatMap((e) => e.hooks ?? [])
      .map((h) => h.type ?? "unknown");
    const matchers = entries
      .map((e) => e.matcher)
      .filter(Boolean)
      .join(", ");

    const typeSummary = [...new Set(hookTypes)].join(", ");
    const description = matchers
      ? `Matcher: ${matchers} (${typeSummary})`
      : typeSummary;

    items.push({
      name: eventName,
      displayName: eventName,
      type: "hook",
      description,
      model: null,
      domain: "",
      source,
      tools: [],
      keywords: [],
      filePath: hooksPath,
    });
  }

  return items;
}
