import fs from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import type { Platform } from "@/types/skills";

export const dynamic = "force-dynamic";

type ScanSource = "global" | "project";

interface DeletePluginPayload {
  pluginId?: string;
  platform?: Platform;
  source?: ScanSource;
}

function parsePluginId(pluginId: string) {
  const at = pluginId.lastIndexOf("@");
  if (at <= 0 || at === pluginId.length - 1) {
    return null;
  }
  return {
    pluginName: pluginId.slice(0, at),
    marketplace: pluginId.slice(at + 1),
  };
}

async function removeClaudeEnabledPlugin(pluginId: string, source: ScanSource) {
  const home = os.homedir();
  const cwd = process.cwd();
  const files =
    source === "project"
      ? [path.join(cwd, ".claude", "settings.local.json"), path.join(cwd, ".claude", "settings.json")]
      : [path.join(home, ".claude", "settings.local.json"), path.join(home, ".claude", "settings.json")];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf-8").catch(() => null);
    if (!raw) continue;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const enabledPlugins = parsed.enabledPlugins;
    if (!enabledPlugins || typeof enabledPlugins !== "object" || Array.isArray(enabledPlugins)) continue;
    if (!(pluginId in enabledPlugins)) continue;
    delete (enabledPlugins as Record<string, unknown>)[pluginId];
    await fs.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
  }
}

async function removeCodexEnabledPlugin(pluginId: string, source: ScanSource) {
  const base = source === "project" ? process.cwd() : os.homedir();
  const configPath = path.join(base, ".codex", "config.toml");
  const raw = await fs.readFile(configPath, "utf-8").catch(() => null);
  if (!raw) return;

  const escaped = pluginId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(
    String.raw`^\[plugins\."${escaped}"\][\s\S]*?(?=^\[|\s*$)`,
    "gm"
  );
  const next = raw.replace(sectionPattern, "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  if (next !== raw) {
    await fs.writeFile(configPath, next, "utf-8");
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DeletePluginPayload | null;
  if (!body?.pluginId || !body.platform || !body.source) {
    return NextResponse.json({ error: "Missing pluginId/platform/source" }, { status: 400 });
  }

  const parsed = parsePluginId(body.pluginId);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid pluginId" }, { status: 400 });
  }

  const homeRoot = body.platform === "claude" ? ".claude" : ".codex";
  const cacheDir = path.join(
    os.homedir(),
    homeRoot,
    "plugins",
    "cache",
    parsed.marketplace,
    parsed.pluginName
  );
  await fs.rm(cacheDir, { recursive: true, force: true });

  if (body.platform === "claude") {
    await removeClaudeEnabledPlugin(body.pluginId, body.source);
  } else {
    await removeCodexEnabledPlugin(body.pluginId, body.source);
  }

  return NextResponse.json({ ok: true, deletedPath: cacheDir });
}

