"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SkillItem } from "@/types/skills";

const typeStyles: Record<string, { bg: string; text: string }> = {
  agent: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  skill: { bg: "bg-violet-500/10 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400" },
  command: { bg: "bg-orange-500/10 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
  plugin: { bg: "bg-green-500/10 dark:bg-green-500/20", text: "text-green-600 dark:text-green-400" },
  hook: { bg: "bg-yellow-500/10 dark:bg-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400" },
};

const modelColors: Record<string, string> = {
  sonnet: "bg-green-500",
  opus: "bg-blue-500",
  haiku: "bg-amber-500",
};

export function SkillCard({ item }: { item: SkillItem }) {
  const [expanded, setExpanded] = useState(false);
  const style = typeStyles[item.type] ?? { bg: "bg-muted", text: "text-muted-foreground" };

  return (
    <Card
      className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 data-[expanded=true]:ring-2 data-[expanded=true]:ring-primary/50"
      data-expanded={expanded}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
            {item.type}
          </span>
          <CardTitle className="flex-1 truncate text-sm">
            {item.displayName || item.name}
          </CardTitle>
          {item.model && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${modelColors[item.model.toLowerCase()] ?? "bg-gray-400"}`}
              title={item.model}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {item.domain && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {item.domain}
            </Badge>
          )}
          {item.source && (
            <span className="text-[10px] italic text-muted-foreground">
              {item.source}
            </span>
          )}
        </div>
        {!expanded && item.description && (
          <CardDescription className="truncate">
            {item.description}
          </CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 border-t pt-3">
          <p className="text-sm text-foreground leading-relaxed">
            {item.description}
          </p>

          {item.model && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Model</span>
              <span className="text-xs">{item.model}</span>
            </div>
          )}

          {(item.tools?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Tools</span>
              <div className="flex flex-wrap gap-1">
                {item.tools.map((tool) => (
                  <Badge key={tool} variant="outline" className="text-[10px] h-4 px-1.5">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(item.keywords?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Keywords</span>
              <div className="flex flex-wrap gap-1">
                {item.keywords?.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-[10px] h-4 px-1.5">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
