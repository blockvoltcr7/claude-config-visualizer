"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SkillCard } from "@/components/skill-card";
import type { SkillItem, SkillsData, Category } from "@/types/skills";

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "agent", label: "Agents" },
  { key: "skill", label: "Skills" },
  { key: "command", label: "Commands" },
  { key: "plugin", label: "Plugins" },
  { key: "hook", label: "Hooks" },
];

export function SkillsDashboard({ data: initialData }: { data: SkillsData }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
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

  const counts = useMemo(
    () => ({
      all: allItems.length,
      agent: data.agents.length,
      skill: data.skills.length,
      command: data.commands.length,
      plugin: data.plugins.length,
      hook: data.hooks.length,
    }),
    [allItems, data]
  );

  const filtered = useMemo(() => {
    let items = category === "all"
      ? allItems
      : allItems.filter((i) => i.type === category);

    if (!search) return items;

    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.displayName.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.domain ?? "").toLowerCase().includes(q) ||
        i.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [allItems, category, search]);

  const isEmpty = allItems.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Claude Skills Visualizer</h1>
          <p className="text-sm text-muted-foreground">{allItems.length} items across your Claude Code setup</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Search skills, agents, commands..."
            className="sm:max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={rescan}
            disabled={rescanning}
          >
            {rescanning ? "Scanning..." : "Rescan"}
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-lg font-medium text-muted-foreground">
            No .claude directory found
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create agents, skills, commands, or hooks in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.claude/</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.claude/</code> in your project, then click Rescan.
          </p>
        </div>
      ) : (
        /* Category Tabs */
        <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
          <TabsList variant="line">
            {categories.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5">
                {cat.label}
                <Badge variant="secondary" className="text-[10px] h-4 min-w-5 px-1">
                  {counts[cat.key]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.key} value={cat.key}>
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No items match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((item) => (
                    <SkillCard key={`${item.type}-${item.name}`} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
