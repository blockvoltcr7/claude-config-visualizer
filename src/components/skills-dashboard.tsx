"use client";

import { useCallback, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Command,
  Cpu,
  Globe,
  Layers3,
  Link2,
  PlugZap,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { SkillCard } from "@/components/skill-card";
import { Button } from "@/components/ui/button";
import { getSkillItemStableKey } from "@/lib/skill-item-key";
import { cn } from "@/lib/utils";
import type { Category, SkillItem, SkillsData } from "@/types/skills";

type PlatformFilter = "all" | "claude" | "codex";

const categories: {
  key: Category;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "all", label: "All Items", icon: Layers3 },
  { key: "agent", label: "Agents", icon: Bot },
  { key: "skill", label: "Skills", icon: Sparkles },
  { key: "command", label: "Commands", icon: Command },
  { key: "plugin", label: "Plugins", icon: PlugZap },
  { key: "hook", label: "Hooks", icon: Link2 },
];

const platformFilters: {
  key: PlatformFilter;
  label: string;
}[] = [
  { key: "all", label: "All Platforms" },
  { key: "claude", label: "Claude" },
  { key: "codex", label: "Codex" },
];

const removalGuides: Array<{
  title: string;
  label: string;
  commands: string[];
}> = [
  {
    title: "Claude Plugins",
    label: "Disable or uninstall by plugin ID",
    commands: [
      "claude plugins list",
      "claude plugins disable <plugin>@<marketplace>",
      "claude plugins uninstall <plugin>@<marketplace>",
    ],
  },
  {
    title: "Codex Plugins",
    label: "Disable in config, optionally clear cache",
    commands: [
      "~/.codex/config.toml => [plugins.\"<plugin>@<marketplace>\"] enabled = false",
      "rm -rf ~/.codex/plugins/cache/<marketplace>/<plugin>",
      "codex plugin marketplace remove <marketplace-name>",
    ],
  },
  {
    title: "Claude Skills",
    label: "Remove skill folders",
    commands: [
      "rm -rf ~/.claude/skills/<skill-name>",
      "rm -rf ./.claude/skills/<skill-name>",
    ],
  },
  {
    title: "Codex Skills",
    label: "Remove skill folders",
    commands: [
      "rm -rf ~/.codex/skills/<skill-name>",
      "rm -rf ./.codex/skills/<skill-name>",
    ],
  },
];

export function SkillsDashboard({ data: initialData }: { data: SkillsData }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [rescanning, setRescanning] = useState(false);

  const rescan = useCallback(async () => {
    setRescanning(true);
    try {
      const res = await fetch("/api/scan");
      if (res.ok) {
        const fresh: SkillsData = await res.json();
        setData(fresh);
      }
    } finally {
      setRescanning(false);
    }
  }, []);

  const allItems: SkillItem[] = useMemo(
    () => [
      ...data.agents,
      ...data.skills,
      ...data.commands,
      ...data.plugins,
      ...data.hooks,
    ],
    [data]
  );

  const platformFilteredItems = useMemo(
    () =>
      platform === "all"
        ? allItems
        : allItems.filter((item) => item.platform === platform),
    [allItems, platform]
  );

  const counts = useMemo(
    () => ({
      all: platformFilteredItems.length,
      agent: data.agents.filter((item) => platform === "all" || item.platform === platform).length,
      skill: data.skills.filter((item) => platform === "all" || item.platform === platform).length,
      command: data.commands.filter((item) => platform === "all" || item.platform === platform).length,
      plugin: data.plugins.filter((item) => platform === "all" || item.platform === platform).length,
      hook: data.hooks.filter((item) => platform === "all" || item.platform === platform).length,
    }),
    [platform, platformFilteredItems.length, data]
  );

  const uniqueDomains = useMemo(
    () =>
      new Set(
        allItems
          .map((item) => item.domain?.trim().toLowerCase())
          .filter((domain): domain is string => Boolean(domain))
      ).size,
    [allItems]
  );

  const modelFamilies = useMemo(
    () =>
      new Set(
        allItems
          .map((item) => item.model?.trim().toLowerCase())
          .filter((model): model is string => Boolean(model))
      ).size,
    [allItems]
  );

  const projectScoped = useMemo(
    () => allItems.filter((item) => item.source === "project").length,
    [allItems]
  );

  const filtered = useMemo(() => {
    const categoryItems =
      category === "all"
        ? platformFilteredItems
        : platformFilteredItems.filter((item) => item.type === category);

    if (!search) {
      return categoryItems;
    }

    const query = search.toLowerCase();

    return categoryItems.filter(
      (item) =>
        item.displayName.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.domain ?? "").toLowerCase().includes(query) ||
        (item.pluginId ?? "").toLowerCase().includes(query) ||
        (item.pluginDisplayName ?? "").toLowerCase().includes(query) ||
        (item.pluginVersion ?? "").toLowerCase().includes(query) ||
        (item.status ?? "").toLowerCase().includes(query) ||
        (item.version ?? "").toLowerCase().includes(query) ||
        item.platform.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.tools.some((tool) => tool.toLowerCase().includes(query)) ||
        item.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
    );
  }, [platformFilteredItems, category, search]);

  const activeCategoryLabel = useMemo(
    () => categories.find((cat) => cat.key === category)?.label ?? "All Items",
    [category]
  );

  const isEmpty = allItems.length === 0;

  const stats: {
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
  }[] = [
    {
      label: "Indexed Entries",
      value: counts.all,
      icon: Layers3,
      color: "var(--signal-cyan)",
    },
    {
      label: "Model Families",
      value: modelFamilies,
      icon: Cpu,
      color: "var(--signal-amber)",
    },
    {
      label: "Distinct Domains",
      value: uniqueDomains,
      icon: Globe,
      color: "var(--signal-emerald)",
    },
    {
      label: "Project Scoped",
      value: projectScoped,
      icon: Radar,
      color: "var(--signal-blue)",
    },
  ];

  return (
    <main className="relative mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 md:px-8 md:pt-12">
      <section
        className="reveal-up relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-[color:var(--panel)] px-6 py-7 shadow-[0_28px_90px_-48px_rgba(14,26,44,0.55)] backdrop-blur-xl md:px-10 md:py-10"
        style={{ animationDelay: "60ms" }}
      >
        <div className="pointer-events-none absolute -left-10 top-2 h-24 w-24 rounded-full bg-[color:var(--signal-amber)]/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-28 w-28 rounded-full bg-[color:var(--signal-cyan)]/20 blur-3xl" />

        <p className="font-mono text-[11px] tracking-[0.22em] text-[color:var(--ink-muted)] uppercase">
          Configuration Atlas
        </p>
        <div className="mt-4 max-w-3xl space-y-3">
          <h1 className="font-display text-[clamp(2rem,4vw,3.5rem)] leading-[0.96] text-[color:var(--ink-strong)]">
            Claude Skills Visualizer
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-[color:var(--ink-soft)] md:text-base">
            Explore every agent, skill, command, plugin, and hook in one
            operational view. Filter quickly, inspect metadata, and rescan your
            setup in real time.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article
                key={stat.label}
                className="rounded-2xl border border-foreground/10 bg-[color:var(--panel-strong)]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--ink-muted)] uppercase">
                    {stat.label}
                  </span>
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/55"
                    style={{ color: stat.color }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                </div>
                <p className="font-display text-3xl leading-none text-[color:var(--ink-strong)]">
                  {stat.value}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="reveal-up mt-6 rounded-[1.6rem] border border-foreground/10 bg-[color:var(--panel)] p-4 shadow-[0_20px_70px_-55px_rgba(14,26,44,0.7)] backdrop-blur-xl md:p-5"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="group relative flex h-12 flex-1 items-center rounded-2xl border border-foreground/10 bg-[color:var(--panel-strong)]/85 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <Search className="mr-2.5 size-4 text-[color:var(--ink-muted)] transition-colors group-focus-within:text-[color:var(--ink-strong)]" />
            <input
              type="search"
              placeholder="Search name, description, domain, keywords, platform, or tools"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-[15px] text-[color:var(--ink-strong)] placeholder:text-[color:var(--ink-muted)] outline-none"
            />
          </label>
          <Button
            variant="outline"
            onClick={rescan}
            disabled={rescanning}
            className="h-12 rounded-2xl border-foreground/15 bg-[color:var(--ink-strong)] px-5 text-[13px] font-semibold tracking-[0.08em] text-[color:var(--background)] uppercase shadow-[0_14px_30px_-20px_rgba(15,26,44,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-[color:var(--ink-strong)]/90 disabled:translate-y-0"
          >
            <RefreshCw
              className={cn("size-4", rescanning && "animate-spin")}
              aria-hidden="true"
            />
            {rescanning ? "Scanning" : "Rescan"}
          </Button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.key;

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "group flex h-[3.35rem] items-center gap-2.5 rounded-2xl border px-3.5 text-left transition-all",
                  active
                    ? "border-transparent bg-[color:var(--ink-strong)] text-[color:var(--background)] shadow-[0_16px_40px_-28px_rgba(14,26,44,0.9)]"
                    : "border-foreground/10 bg-[color:var(--panel-strong)]/65 text-[color:var(--ink-soft)] hover:-translate-y-0.5 hover:border-foreground/20 hover:text-[color:var(--ink-strong)]"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    active
                      ? "border-white/35 bg-white/15"
                      : "border-black/10 bg-white/60"
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {cat.label}
                  </span>
                  <span
                    className={cn(
                      "block text-[11px] leading-tight",
                      active ? "text-white/70" : "text-[color:var(--ink-muted)]"
                    )}
                  >
                    {counts[cat.key]} items
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {platformFilters.map((platformFilter) => {
            const active = platform === platformFilter.key;

            return (
              <button
                key={platformFilter.key}
                type="button"
                onClick={() => setPlatform(platformFilter.key)}
                className={cn(
                  "group flex h-10 items-center justify-center rounded-2xl border px-3.5 text-sm font-semibold transition-all",
                  active
                    ? "border-transparent bg-[color:var(--ink-strong)] text-[color:var(--background)] shadow-[0_14px_30px_-22px_rgba(14,26,44,0.9)]"
                    : "border-foreground/10 bg-[color:var(--panel-strong)]/65 text-[color:var(--ink-soft)] hover:-translate-y-0.5 hover:border-foreground/20 hover:text-[color:var(--ink-strong)]"
                )}
              >
                {platformFilter.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="reveal-up mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]" style={{ animationDelay: "180ms" }}>
        <div>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <p className="font-display text-3xl leading-none text-[color:var(--ink-strong)]">
              {filtered.length} Result{filtered.length === 1 ? "" : "s"}
            </p>
            <p className="font-mono text-[11px] tracking-[0.15em] text-[color:var(--ink-muted)] uppercase">
              Active View: {activeCategoryLabel}
            </p>
          </div>

          {isEmpty ? (
            <div className="rounded-[1.6rem] border border-foreground/12 bg-[color:var(--panel)]/90 px-6 py-14 text-center shadow-[0_24px_60px_-48px_rgba(14,26,44,0.8)]">
              <p className="font-display text-3xl text-[color:var(--ink-strong)]">
                No Config Items Found
              </p>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[color:var(--ink-soft)]">
                Add agents, skills, commands, plugins, or hooks in your Claude
                configuration, then run a rescan to populate this dashboard.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-foreground/20 bg-[color:var(--panel)]/75 px-6 py-12 text-center">
              <p className="font-display text-2xl text-[color:var(--ink-strong)]">
                No matches for this filter
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm text-[color:var(--ink-soft)]">
                Adjust your search query or switch categories and platform to reveal more
                entries.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((item, index) => (
                <SkillCard
                  key={getSkillItemStableKey(item)}
                  item={item}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[1.6rem] border border-foreground/12 bg-[color:var(--panel)]/95 p-4 shadow-[0_24px_64px_-50px_rgba(14,26,44,0.8)] md:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] tracking-[0.15em] text-[color:var(--ink-muted)] uppercase">
                  Helpful CLI Hints
                </p>
                <h2 className="mt-1 font-display text-2xl leading-none text-[color:var(--ink-strong)]">
                  Removal Guide
                </h2>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[color:var(--signal-rose)]">
                <Trash2 className="size-4" />
              </span>
            </div>

            <div className="space-y-3">
              {removalGuides.map((guide) => (
                <article
                  key={guide.title}
                  className="rounded-2xl border border-foreground/10 bg-[color:var(--panel-strong)]/85 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                >
                  <p className="text-sm font-semibold text-[color:var(--ink-strong)]">
                    {guide.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--ink-soft)]">
                    {guide.label}
                  </p>
                  <div className="mt-2.5 space-y-1.5 rounded-xl border border-black/8 bg-white/45 p-2.5">
                    {guide.commands.map((command) => (
                      <p
                        key={command}
                        className="font-mono text-[11px] leading-relaxed break-words [overflow-wrap:anywhere] text-[color:var(--ink-strong)]"
                      >
                        <Terminal className="mr-1 inline size-3 align-[-0.075rem] text-[color:var(--ink-muted)]" />
                        {command}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
