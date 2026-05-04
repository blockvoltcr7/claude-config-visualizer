# Claude Config Visualizer

Claude Config Visualizer is a local Next.js dashboard for auditing the agent tooling installed on a workstation. It scans Claude Code and Codex configuration folders, indexes the agents, skills, slash commands, plugins, and hooks it finds, then renders them in one searchable operational view.

The app is built for people who actively manage local AI-agent setups and need to answer practical questions quickly:

- What agents, skills, commands, plugins, and hooks are installed?
- Which items belong to Claude vs. Codex?
- Which items are global vs. project-scoped?
- Which plugins are enabled, disabled, cached, or contributing bundled tools?
- Which skill or plugin folders can be removed from disk?

## What It Scans

The scanner reads both global and project-local configuration roots:

| Platform | Global root | Project root |
| --- | --- | --- |
| Claude | `~/.claude` | `./.claude` |
| Codex | `~/.codex` | `./.codex` |

It indexes:

- Agents from `agents/`
- Skills from `skills/*/SKILL.md`
- Commands from `commands/*.md`
- Hooks from supported hook configuration files
- Plugin inventory and plugin bundle contents from `plugins/cache`

Enabled plugin bundles are scanned for their own agents, skills, commands, and hooks. Bundled items are tagged with the plugin name, plugin version, platform, and source scope so they can be distinguished from standalone local configuration.

## App Features

- Unified dashboard for Claude and Codex configuration items
- Platform filter for `All Platforms`, `Claude`, and `Codex`
- Category filters for agents, skills, commands, plugins, and hooks
- Search across names, descriptions, domains, keywords, tools, plugin metadata, status, version, and platform
- Summary metrics for indexed entries, model families, distinct domains, and project-scoped items
- Expandable cards with source, platform, model, tools, file paths, plugin metadata, and plugin contribution counts
- Live rescan through `/api/scan`
- Static fallback data from `src/data/skills-data.json` when no local configuration is found
- Skill deletion for allowed Claude/Codex skill folders
- Plugin deletion for cached plugin files plus enablement cleanup in the relevant platform config
- Built-in CLI removal hints for common Claude and Codex cleanup workflows

## Deletion Behavior

Deletion actions are intentionally scoped to known local configuration paths.

Skill deletion removes the containing skill folder only when the selected file is a `SKILL.md` under one of these roots:

- `~/.claude/skills`
- `~/.codex/skills`
- `./.claude/skills`
- `./.codex/skills`

Plugin deletion removes the cached plugin directory under the selected platform root and attempts to unset the plugin from the relevant global or project configuration:

- Claude plugin enablement is removed from `settings.local.json` or `settings.json`
- Codex plugin enablement is removed from the matching `[plugins."<plugin>@<marketplace>"]` block in `.codex/config.toml`

The dashboard triggers a rescan after successful deletion so the UI reflects the filesystem state.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn-style local UI primitives
- Lucide React icons
- gray-matter for Markdown frontmatter parsing
- Vitest for scanner and key-generation tests

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app scans the current process working directory for project-local config, so run it from the repository where you want `./.claude` and `./.codex` to be considered project scope.

## Scripts

```bash
npm run dev      # Start the local development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
npm run test     # Run Vitest
```

## Project Layout

```text
src/app/page.tsx                  # Server-rendered entry point and scan fallback
src/app/api/scan/route.ts          # Live rescan endpoint
src/app/api/skills/delete/route.ts # Skill deletion endpoint
src/app/api/plugins/delete/route.ts # Plugin deletion endpoint
src/components/skills-dashboard.tsx # Main dashboard UI
src/components/skill-card.tsx       # Expandable item card and actions
src/lib/scanner/                    # Filesystem scanners and parsers
src/lib/skill-item-key.ts           # Stable dedupe/render keys
src/types/skills.ts                 # Shared item and payload types
docs/arch/                          # Architecture notes and diagrams
```

## Architecture Notes

The app keeps filesystem access on the server side. `src/app/page.tsx` performs the initial scan during rendering, while `/api/scan` supports client-triggered refreshes. The client dashboard owns filters, search state, expansion state, and deletion actions.

Scanner output is normalized into a shared `SkillsData` shape with platform-aware stable keys. This prevents Claude and Codex items with the same name and type from collapsing into one card.

More detail is available in [docs/arch/README.md](docs/arch/README.md).
