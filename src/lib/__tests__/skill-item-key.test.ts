import { describe, expect, it } from "vitest";
import { getSkillItemStableKey } from "@/lib/skill-item-key";
import type { SkillItem } from "@/types/skills";

function makeItem(overrides: Partial<SkillItem>): SkillItem {
  return {
    name: "example",
    displayName: "Example",
    platform: "claude",
    type: "skill",
    description: "",
    model: null,
    source: "global",
    tools: [],
    ...overrides,
  };
}

describe("getSkillItemStableKey", () => {
  it("uses plugin identity for plugin cards", () => {
    expect(
      getSkillItemStableKey(
        makeItem({
          type: "plugin",
          name: "alpha-toolkit",
          domain: "acme",
          pluginId: "alpha-toolkit@acme",
        })
      )
    ).toBe("claude::alpha-toolkit@acme::plugin");
  });

  it("includes pluginId for plugin-origin items", () => {
    const first = getSkillItemStableKey(
      makeItem({
        type: "agent",
        name: "code-reviewer",
        platform: "codex",
        pluginId: "plugin-one@acme",
      })
    );
    const second = getSkillItemStableKey(
      makeItem({
        type: "agent",
        name: "code-reviewer",
        platform: "codex",
        pluginId: "plugin-two@acme",
      })
    );

    expect(first).toBe("codex::plugin-one@acme::code-reviewer::agent");
    expect(second).toBe("codex::plugin-two@acme::code-reviewer::agent");
    expect(first).not.toBe(second);
  });
});
