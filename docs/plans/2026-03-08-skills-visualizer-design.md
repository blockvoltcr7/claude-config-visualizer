# Claude Skills Visualizer - Design

## Goal
SvelteKit app to visualize Claude Code skills, agents, commands, plugins, and hooks in an interactive card grid.

## Stack
- SvelteKit (Svelte 5 with runes)
- Vanilla CSS with custom properties
- Static JSON data source

## Components
- `Header.svelte` — Title + search bar
- `CategoryTabs.svelte` — Agents | Skills | Commands | Plugins | Hooks
- `CardGrid.svelte` — Responsive filtered grid
- `SkillCard.svelte` — Card with name, type badge, model, domain tag
- `DetailPanel.svelte` — Expandable detail view

## Data Flow
1. Static `skills-data.json` imported at build time
2. Runes-based filter store (search + category)
3. Reactive derived filtering in CardGrid
4. Click card → toggle inline DetailPanel

## Features
- Search across name + description
- Category tabs with counts
- Model indicators (Sonnet/Opus)
- Domain tags per item
- Dark mode (prefers-color-scheme)
- Responsive CSS grid

## Not Included
- No database, auth, or API routes
- No dependency graph (future)
- Read-only viewer
