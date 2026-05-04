"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillItem } from "@/types/skills";

const typeStyles: Record<
  SkillItem["type"],
  {
    chip: string;
    ribbon: string;
    glow: string;
    tint: string;
  }
> = {
  agent: {
    chip: "border-cyan-900/20 bg-cyan-500/15 text-cyan-900 dark:border-cyan-200/30 dark:bg-cyan-400/20 dark:text-cyan-100",
    ribbon: "from-cyan-400 via-cyan-500 to-cyan-700",
    glow: "hover:shadow-[0_28px_55px_-42px_rgba(8,145,178,0.75)]",
    tint: "bg-cyan-500/12",
  },
  skill: {
    chip: "border-amber-900/20 bg-amber-500/18 text-amber-900 dark:border-amber-100/35 dark:bg-amber-400/22 dark:text-amber-100",
    ribbon: "from-amber-300 via-amber-500 to-amber-700",
    glow: "hover:shadow-[0_28px_55px_-42px_rgba(217,119,6,0.8)]",
    tint: "bg-amber-500/14",
  },
  command: {
    chip: "border-rose-900/20 bg-rose-500/16 text-rose-900 dark:border-rose-100/35 dark:bg-rose-400/20 dark:text-rose-100",
    ribbon: "from-rose-300 via-rose-500 to-rose-700",
    glow: "hover:shadow-[0_28px_55px_-42px_rgba(225,29,72,0.75)]",
    tint: "bg-rose-500/12",
  },
  plugin: {
    chip: "border-emerald-900/20 bg-emerald-500/16 text-emerald-900 dark:border-emerald-100/35 dark:bg-emerald-400/20 dark:text-emerald-100",
    ribbon: "from-emerald-300 via-emerald-500 to-emerald-700",
    glow: "hover:shadow-[0_28px_55px_-42px_rgba(5,150,105,0.8)]",
    tint: "bg-emerald-500/12",
  },
  hook: {
    chip: "border-blue-900/20 bg-blue-500/14 text-blue-900 dark:border-blue-100/35 dark:bg-blue-400/20 dark:text-blue-100",
    ribbon: "from-blue-300 via-blue-500 to-blue-700",
    glow: "hover:shadow-[0_28px_55px_-42px_rgba(37,99,235,0.8)]",
    tint: "bg-blue-500/12",
  },
};

const sourceLabels: Record<SkillItem["source"], string> = {
  project: "Project",
  global: "Global",
  "built-in": "Built-in",
};

const modelStyles: Record<string, string> = {
  sonnet:
    "border-cyan-900/20 bg-cyan-500/15 text-cyan-900 dark:border-cyan-100/30 dark:bg-cyan-400/22 dark:text-cyan-100",
  opus:
    "border-amber-900/20 bg-amber-500/18 text-amber-900 dark:border-amber-100/30 dark:bg-amber-400/22 dark:text-amber-100",
  haiku:
    "border-emerald-900/20 bg-emerald-500/16 text-emerald-900 dark:border-emerald-100/30 dark:bg-emerald-400/22 dark:text-emerald-100",
};

const pluginStatusStyles: Record<NonNullable<SkillItem["status"]>, string> = {
  enabled:
    "border-emerald-900/20 bg-emerald-500/16 text-emerald-900 dark:border-emerald-100/30 dark:bg-emerald-400/22 dark:text-emerald-100",
  disabled:
    "border-slate-900/20 bg-slate-500/14 text-slate-900 dark:border-slate-100/30 dark:bg-slate-400/22 dark:text-slate-100",
};

function previewText(text: string) {
  if (text.length <= 130) return text;
  return `${text.slice(0, 127).trimEnd()}...`;
}

function formatCountChip(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function SkillCard({ item, index = 0 }: { item: SkillItem; index?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const style = typeStyles[item.type];

  const summary = useMemo(() => previewText(item.description), [item.description]);
  const pluginCountChips = useMemo(() => {
    if (item.type !== "plugin" || !item.pluginCounts) {
      return [];
    }

    return [
      { label: "skill", count: item.pluginCounts.skills },
      { label: "command", count: item.pluginCounts.commands },
      { label: "agent", count: item.pluginCounts.agents },
      { label: "hook", count: item.pluginCounts.hooks },
    ].filter((entry) => entry.count > 0);
  }, [item]);

  async function handleDeleteSkill() {
    if (!item.filePath || item.type !== "skill" || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete this skill folder?\n\n${item.filePath}`
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/skills/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filePath: item.filePath }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to delete skill");
      }

      window.dispatchEvent(new CustomEvent("skills:rescan"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete skill";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeletePlugin() {
    if (!item.pluginId || item.type !== "plugin" || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete plugin ${item.pluginId}?\n\nThis removes cached plugin files and unsets its enablement from ${item.source} config.`
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/plugins/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pluginId: item.pluginId,
          platform: item.platform,
          source: item.source,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to delete plugin");
      }

      window.dispatchEvent(new CustomEvent("skills:rescan"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete plugin";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className={cn(
        "reveal-up group relative overflow-hidden rounded-[1.45rem] border border-foreground/10 bg-[color:var(--panel-strong)]/90 p-4 text-sm text-[color:var(--ink-strong)] shadow-[0_24px_55px_-44px_rgba(15,26,44,0.85)] transition-all duration-500 hover:-translate-y-1",
        style.glow,
        expanded && "border-foreground/20 shadow-[0_26px_58px_-42px_rgba(15,26,44,0.95)]"
      )}
      style={{ animationDelay: `${Math.min(index * 45, 420)}ms` }}
      data-expanded={expanded}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r",
          style.ribbon
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl",
          style.tint
        )}
      />

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full text-left focus-visible:outline-none"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 font-mono text-[10px] tracking-[0.12em] uppercase",
              style.chip
            )}
          >
            {item.type}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[1.32rem] leading-tight text-[color:var(--ink-strong)]">
              {item.displayName || item.name}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
              {expanded ? item.description : summary}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-foreground/12 bg-white/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-muted)]">
            {expanded ? "Open" : "Peek"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.domain ? (
            <span className="inline-flex h-5 items-center rounded-full border border-foreground/10 bg-white/45 px-2.5 font-mono text-[10px] tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">
              {item.domain}
            </span>
          ) : null}
          <span className="inline-flex h-5 items-center rounded-full border border-foreground/10 bg-white/45 px-2.5 font-mono text-[10px] tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">
            {sourceLabels[item.source]}
          </span>
          <span className="inline-flex h-5 items-center rounded-full border border-foreground/10 bg-white/45 px-2.5 font-mono text-[10px] tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">
            {item.platform === "codex" ? "Codex" : "Claude"}
          </span>

          {item.model ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2.5 font-mono text-[10px] tracking-[0.08em] uppercase",
                modelStyles[item.model.toLowerCase()] ??
                  "border-foreground/10 bg-white/45 text-[color:var(--ink-soft)]"
              )}
            >
              {item.model}
            </span>
          ) : null}

          {item.type === "plugin" && item.status ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2.5 font-mono text-[10px] tracking-[0.08em] uppercase",
                pluginStatusStyles[item.status]
              )}
            >
              {item.status}
            </span>
          ) : null}

          {item.type === "plugin" && item.version ? (
            <span className="inline-flex h-5 items-center rounded-full border border-foreground/10 bg-white/45 px-2.5 font-mono text-[10px] tracking-[0.08em] text-[color:var(--ink-soft)] uppercase">
              v{item.version}
            </span>
          ) : null}

          {item.type !== "plugin" && item.pluginDisplayName ? (
            <span className="inline-flex h-5 items-center rounded-full border border-emerald-900/15 bg-emerald-500/12 px-2.5 font-mono text-[10px] tracking-[0.08em] text-emerald-900 uppercase dark:border-emerald-100/25 dark:bg-emerald-400/20 dark:text-emerald-100">
              From {item.pluginDisplayName}
            </span>
          ) : null}

          {item.type === "plugin" && pluginCountChips.length > 0
            ? pluginCountChips.map((entry) => (
                <span
                  key={entry.label}
                  className="inline-flex h-5 items-center rounded-full border border-foreground/10 bg-white/45 px-2.5 font-mono text-[10px] tracking-[0.08em] text-[color:var(--ink-soft)]"
                >
                  {formatCountChip(entry.label, entry.count)}
                </span>
              ))
            : null}

          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--ink-muted)]">
            Details
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-300",
                expanded && "rotate-180"
              )}
            />
          </span>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-400 ease-out",
          expanded ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 rounded-xl border border-foreground/10 bg-white/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            {item.tools.length > 0 ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Tools
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-foreground/10 bg-[color:var(--panel)] px-2 py-1 font-mono text-[10px] text-[color:var(--ink-soft)]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {item.keywords && item.keywords.length > 0 ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-foreground/10 bg-[color:var(--panel)] px-2 py-1 font-mono text-[10px] text-[color:var(--ink-soft)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {item.type !== "plugin" && item.pluginDisplayName ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Plugin Source
                </p>
                <div className="space-y-1">
                  <p className="rounded-lg border border-foreground/10 bg-[color:var(--panel)] px-2.5 py-1.5 font-medium text-[color:var(--ink-strong)]">
                    {item.pluginDisplayName}
                  </p>
                  {item.pluginId ? (
                    <p className="truncate rounded-lg border border-foreground/10 bg-[color:var(--panel)] px-2.5 py-1.5 font-mono text-[11px] text-[color:var(--ink-soft)]">
                      {item.pluginId}
                    </p>
                  ) : null}
                  {item.pluginVersion ? (
                    <p className="rounded-lg border border-foreground/10 bg-[color:var(--panel)] px-2.5 py-1.5 font-mono text-[11px] text-[color:var(--ink-soft)] uppercase">
                      Plugin v{item.pluginVersion}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {item.type === "plugin" && pluginCountChips.length > 0 ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Bundle Contents
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pluginCountChips.map((entry) => (
                    <span
                      key={`${entry.label}-details`}
                      className="rounded-full border border-foreground/10 bg-[color:var(--panel)] px-2 py-1 font-mono text-[10px] text-[color:var(--ink-soft)]"
                    >
                      {formatCountChip(entry.label, entry.count)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {item.filePath ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Source Path
                </p>
                <p
                  className="truncate rounded-lg border border-foreground/10 bg-[color:var(--panel)] px-2.5 py-1.5 font-mono text-[11px] text-[color:var(--ink-soft)]"
                  title={item.filePath}
                >
                  {item.filePath}
                </p>
              </div>
            ) : null}

            {item.type === "skill" && item.filePath && !item.pluginId ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Actions
                </p>
                <button
                  type="button"
                  onClick={handleDeleteSkill}
                  disabled={deleting}
                  className="inline-flex h-8 items-center rounded-lg border border-rose-900/20 bg-rose-500/14 px-3 font-mono text-[11px] tracking-[0.06em] text-rose-900 uppercase transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-100/25 dark:bg-rose-400/20 dark:text-rose-100"
                >
                  {deleting ? "Deleting..." : "Delete Skill"}
                </button>
                {deleteError ? (
                  <p className="text-xs text-[color:var(--signal-rose)]">{deleteError}</p>
                ) : null}
              </div>
            ) : null}

            {item.type === "skill" && item.pluginId ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Actions
                </p>
                <p className="rounded-lg border border-foreground/10 bg-[color:var(--panel)] px-2.5 py-1.5 text-xs text-[color:var(--ink-soft)]">
                  Managed by plugin. Disable or uninstall{" "}
                  <span className="font-mono text-[11px] text-[color:var(--ink-strong)]">
                    {item.pluginId}
                  </span>{" "}
                  to remove this skill.
                </p>
              </div>
            ) : null}

            {item.type === "plugin" && item.pluginId ? (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--ink-muted)] uppercase">
                  Actions
                </p>
                <button
                  type="button"
                  onClick={handleDeletePlugin}
                  disabled={deleting}
                  className="inline-flex h-8 items-center rounded-lg border border-rose-900/20 bg-rose-500/14 px-3 font-mono text-[11px] tracking-[0.06em] text-rose-900 uppercase transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-100/25 dark:bg-rose-400/20 dark:text-rose-100"
                >
                  {deleting ? "Deleting..." : "Delete Plugin"}
                </button>
                {deleteError ? (
                  <p className="text-xs text-[color:var(--signal-rose)]">{deleteError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
