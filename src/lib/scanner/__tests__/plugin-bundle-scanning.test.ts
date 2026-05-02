import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it } from "vitest";
import {
  hasScannedData,
  scanClaudeConfigFromDirs,
  scanCodexConfigFromDirs,
} from "@/lib/scanner";
import type { SkillsData } from "@/types/skills";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");
const tempDirs: string[] = [];

async function createFixtureWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-bundle-scan-"));
  tempDirs.push(root);

  const globalDir = path.join(root, "global");
  const projectDir = path.join(root, "project");

  await fs.cp(path.join(fixturesDir, "global-config"), globalDir, { recursive: true });
  await fs.cp(path.join(fixturesDir, "project-config"), projectDir, { recursive: true });

  await fs.utimes(
    path.join(globalDir, "plugins", "cache", "acme", "alpha-toolkit", "1.0.0"),
    new Date("2024-01-01T00:00:00Z"),
    new Date("2024-01-01T00:00:00Z")
  );
  await fs.utimes(
    path.join(globalDir, "plugins", "cache", "acme", "alpha-toolkit", "2.0.0"),
    new Date("2025-01-01T00:00:00Z"),
    new Date("2025-01-01T00:00:00Z")
  );

  return { globalDir, projectDir };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

async function scanFixtureConfig() {
  const { globalDir, projectDir } = await createFixtureWorkspace();
  return scanClaudeConfigFromDirs(globalDir, projectDir);
}

describe("plugin-aware bundle scanning", () => {
  it("materializes enabled plugin bundles as first-class items", async () => {
    const scanned = await scanFixtureConfig();

    const pluginCard = scanned.plugins.find(
      (item) => item.pluginId === "alpha-toolkit@acme"
    );
    expect(pluginCard).toMatchObject({
      status: "enabled",
      version: "2.0.0",
      platform: "claude",
      pluginCounts: {
        skills: 1,
        commands: 1,
        agents: 1,
        hooks: 1,
      },
    });

    expect(
      scanned.skills.find(
        (item) => item.pluginId === "alpha-toolkit@acme" && item.name === "shared-skill"
      )
    ).toMatchObject({
      pluginDisplayName: "Alpha Toolkit",
      pluginVersion: "2.0.0",
      source: "project",
    });
    expect(
      scanned.commands.some(
        (item) => item.pluginId === "alpha-toolkit@acme" && item.name === "assist"
      )
    ).toBe(true);
    expect(
      scanned.agents.some(
        (item) => item.pluginId === "alpha-toolkit@acme" && item.name === "reviewer"
      )
    ).toBe(true);
    expect(
      scanned.hooks.some(
        (item) => item.pluginId === "alpha-toolkit@acme" && item.name === "SessionStart"
      )
    ).toBe(true);
  });

  it("keeps disabled plugin bundles as plugin cards only", async () => {
    const scanned = await scanFixtureConfig();

    expect(
      scanned.plugins.find((item) => item.pluginId === "disabled-suite@acme")
    ).toMatchObject({
      status: "disabled",
      platform: "claude",
      pluginCounts: {
        skills: 1,
        commands: 0,
        agents: 0,
        hooks: 0,
      },
    });
    expect(scanned.skills.some((item) => item.name === "disabled-skill")).toBe(false);
  });

  it("keeps direct and plugin-bundled items with the same name", async () => {
    const scanned = await scanFixtureConfig();
    const sharedSkills = scanned.skills.filter((item) => item.name === "shared-skill");

    expect(sharedSkills).toHaveLength(2);
    expect(sharedSkills.some((item) => !item.pluginId)).toBe(true);
    expect(
      sharedSkills.some((item) => item.pluginId === "alpha-toolkit@acme"
    )).toBe(true);
  });

  it("uses the newest installed release for plugin metadata and counts", async () => {
    const scanned = await scanFixtureConfig();
    const pluginCard = scanned.plugins.find(
      (item) => item.pluginId === "alpha-toolkit@acme"
    );

    expect(pluginCard?.version).toBe("2.0.0");
    expect(pluginCard?.filePath).toContain(
      `${path.sep}alpha-toolkit${path.sep}2.0.0${path.sep}`
    );
    expect(pluginCard?.pluginCounts).toEqual({
      skills: 1,
      commands: 1,
      agents: 1,
      hooks: 1,
    });
  });

  it("treats plugin-only scan results as real data for fallback decisions", () => {
    const pluginOnly: SkillsData = {
      agents: [],
      skills: [],
      commands: [],
      hooks: [],
      plugins: [
        {
          name: "alpha-toolkit",
          platform: "claude",
          displayName: "Alpha Toolkit",
          type: "plugin",
          description: "Plugin-only scan result",
          model: null,
          domain: "acme",
          source: "global",
          tools: [],
          pluginId: "alpha-toolkit@acme",
          status: "enabled",
        },
      ],
    };

    expect(hasScannedData(pluginOnly)).toBe(true);
  });

  it("parses Codex plugin enablement from TOML and materializes enabled bundles", async () => {
    const { globalDir, projectDir } = await createFixtureWorkspace();
    await fs.writeFile(
      path.join(globalDir, "config.toml"),
      [
        '[plugins."alpha-toolkit@acme"]',
        "enabled = true",
        "",
        '[plugins."disabled-suite@acme"]',
        "enabled = false",
        "",
      ].join("\n"),
      "utf-8"
    );

    const scanned = await scanCodexConfigFromDirs(globalDir, projectDir);
    const alphaPlugin = scanned.plugins.find(
      (item) => item.pluginId === "alpha-toolkit@acme"
    );

    expect(alphaPlugin).toMatchObject({
      platform: "codex",
      status: "enabled",
      source: "global",
    });
    expect(
      scanned.skills.some(
        (item) => item.platform === "codex" && item.pluginId === "alpha-toolkit@acme"
      )
    ).toBe(true);
  });
});
