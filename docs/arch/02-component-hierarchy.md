# 02 — Component Hierarchy

## React Component Tree

```mermaid
graph TD
    ROOT["RootLayout\napp/layout.tsx\n🖥 Server Component\n────────────────\n• Loads Google Fonts\n  Bricolage Grotesque\n  IBM Plex Sans\n  IBM Plex Mono\n• Sets html/body classes\n• Injects font CSS variables"]

    PAGE["Home (Page)\napp/page.tsx\n🖥 Server Component · force-dynamic\n────────────────\n• Calls scanClaudeConfig() at request time\n• Falls back to skills-data.json if empty\n• Passes SkillsData as props"]

    DASH["SkillsDashboard\ncomponents/skills-dashboard.tsx\n💻 Client Component\n────────────────\n• Owns: data, search, category, rescanning state\n• Derives: allItems, counts, filtered, stats\n• Handles: rescan() via fetch('/api/scan')"]

    HEADER["Hero Section\n(inline in SkillsDashboard)\n────────────────\n• Title & description\n• 4x stat cards\n  (Indexed / Model Families /\n   Distinct Domains / Project Scoped)"]

    TOOLBAR["Filter Toolbar\n(inline in SkillsDashboard)\n────────────────\n• Search input\n• Rescan button\n• 6x category filter buttons\n  (All · Agents · Skills ·\n   Commands · Plugins · Hooks)"]

    RESULTS["Results Section\n(inline in SkillsDashboard)\n────────────────\n• Result count heading\n• Active category label\n• Empty states (no config / no match)"]

    CARD["SkillCard\ncomponents/skill-card.tsx\n💻 Client Component\n────────────────\n• Owns: expanded (toggle) state\n• Shows: type chip, name, description preview\n• Expanded: tools list, keywords, file path\n• Visual: color ribbon + glow per type"]

    UI_BADGE["ui/badge.tsx\nshadcn/ui primitive"]
    UI_BUTTON["ui/button.tsx\nshadcn/ui primitive"]
    UI_CARD["ui/card.tsx\nshadcn/ui primitive"]
    UI_INPUT["ui/input.tsx\nshadcn/ui primitive"]
    UI_TABS["ui/tabs.tsx\nshadcn/ui primitive"]

    ROOT --> PAGE
    PAGE --> DASH
    DASH --> HEADER
    DASH --> TOOLBAR
    DASH --> RESULTS
    RESULTS -->|"one per filtered item"| CARD

    DASH -.->|"uses"| UI_BUTTON
    CARD -.->|"style only, no direct import"| UI_BADGE
```

---

## Component Responsibilities

### `RootLayout` (`app/layout.tsx`)

Server Component. Static shell. Sole responsibility is injecting the three Google Font families as CSS custom properties (`--font-display`, `--font-body`, `--font-mono`) and applying antialiasing. It never receives or processes data.

### `Home` (`app/page.tsx`)

Server Component marked `force-dynamic` so Next.js re-runs it on every request (no caching). It:
1. Calls `scanClaudeConfig()` which reads the filesystem via Node.js `fs/promises`.
2. Checks if any data was returned; falls back to the bundled `skills-data.json` if not.
3. Passes the resulting `SkillsData` object to `SkillsDashboard` as props.

### `SkillsDashboard` (`components/skills-dashboard.tsx`)

The central Client Component. All UI interactivity lives here. It manages:

| State | Type | Purpose |
|---|---|---|
| `data` | `SkillsData` | Current dataset (initialised from SSR props) |
| `search` | `string` | Current search query |
| `category` | `Category` | Active filter tab |
| `rescanning` | `boolean` | Loading indicator for rescan button |

Derived values (all via `useMemo`):

| Derived | Purpose |
|---|---|
| `allItems` | Flattened array of all item types |
| `counts` | Per-category item counts for filter badges |
| `uniqueDomains` | Distinct domain/marketplace count for stats |
| `modelFamilies` | Distinct model family count for stats |
| `projectScoped` | Count of items with `source === "project"` |
| `filtered` | Search + category filtered items to render |
| `activeCategoryLabel` | Display name for the active category |

### `SkillCard` (`components/skill-card.tsx`)

Leaf display component. Owns only one piece of state: `expanded` (boolean toggle). Renders:
- A color-coded top ribbon (by type)
- Type chip badge
- Name and description (truncated to 130 chars when collapsed)
- Source, domain, model, status, version metadata badges
- Expandable detail panel with tools list, keywords, and file path

---

## State Ownership Map

```mermaid
stateDiagram-v2
    [*] --> SSR: Page load

    SSR: Server: scanClaudeConfig()
    SSR --> DashboardInit: Pass SkillsData as props

    state DashboardInit {
        data: SkillsData (mutable via rescan)
        search: string ""
        category: Category "all"
        rescanning: boolean false
    }

    DashboardInit --> Searching: User types in search
    DashboardInit --> Filtering: User clicks category
    DashboardInit --> Rescanning: User clicks Rescan

    Searching --> DashboardInit: filtered items update via useMemo
    Filtering --> DashboardInit: filtered items update via useMemo

    Rescanning --> APICall: fetch('/api/scan')
    APICall --> DashboardInit: setData(fresh) on success

    state CardLocal {
        expanded: boolean false
    }
    DashboardInit --> CardLocal: each SkillCard mounts
    CardLocal --> CardLocal: onClick toggles expanded
```

---

## UI Layer Map

```mermaid
graph LR
    subgraph DesignSystem["Design System"]
        shadcn["shadcn/ui\nBase primitives\nButton · Badge · Card\nInput · Tabs"]
        tailwind["Tailwind CSS v4\nUtility classes"]
        cssVars["CSS Custom Properties\n--panel · --ink-strong\n--signal-* colors\n--font-display/body/mono"]
    end

    subgraph Icons["Icons"]
        lucide["lucide-react\nBot · Sparkles · Command\nPlugZap · Link2 · Layers3\nSearch · RefreshCw · etc."]
    end

    subgraph Fonts["Typography"]
        bricolage["Bricolage Grotesque\n(display font — headings)"]
        ibmSans["IBM Plex Sans\n(body font — prose)"]
        ibmMono["IBM Plex Mono\n(mono font — labels, badges)"]
    end

    CARD["SkillCard"] --> shadcn
    CARD --> tailwind
    CARD --> cssVars
    CARD --> lucide

    DASH["SkillsDashboard"] --> shadcn
    DASH --> tailwind
    DASH --> cssVars
    DASH --> lucide
    DASH --> bricolage
    DASH --> ibmSans
    DASH --> ibmMono
```
