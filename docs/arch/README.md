# Architecture Documentation

> **Claude Skills Visualizer** — A Next.js application that scans your local Claude Code configuration and renders agents, skills, commands, plugins, and hooks in an interactive filterable dashboard.

## Documents

| Document | Description |
|---|---|
| [01 — System Overview](./01-overview.md) | High-level system context, purpose, and architecture diagram |
| [02 — Component Hierarchy](./02-component-hierarchy.md) | React component tree and responsibilities |
| [03 — Data Flow](./03-data-flow.md) | End-to-end data flow from filesystem to UI |
| [04 — Sequence Diagrams](./04-sequences.md) | Key user interaction flows (initial load, rescan, filter) |
| [05 — Tech Stack](./05-tech-stack.md) | Technology choices, versions, and rationale |
| [06 — Scanner Module](./06-scanner-module.md) | Deep-dive into the filesystem scanning subsystem |

## Quick Summary

```
~/.claude/                     ← Source of truth (filesystem)
     │
     ▼
src/lib/scanner/               ← Server-side parsing layer
     │
     ▼
src/app/page.tsx               ← Next.js Server Component (SSR)
     │
     ▼
src/components/skills-dashboard.tsx  ← Client Component (interactive)
     │
     ▼
src/components/skill-card.tsx  ← Leaf display component
```

## Key Design Decisions

1. **Hybrid RSC rendering** — Server Component runs the filesystem scan; Client Component owns all UI state.
2. **Graceful static fallback** — If the scan returns empty, `src/data/skills-data.json` is used instead.
3. **Live rescan via API** — `/api/scan` allows the client to trigger a fresh scan without a page reload.
4. **Deduplication by identity key** — Items with the same `name::type` are merged to prevent duplicates from multiple config locations.
