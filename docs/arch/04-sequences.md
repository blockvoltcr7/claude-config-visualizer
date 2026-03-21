# 04 — Sequence Diagrams

## 1. Initial Page Load

The primary render path. The server reads the filesystem, SSR-renders the dashboard with real data, and hydrates on the client.

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant NextServer as Next.js Server\n(Node.js)
    participant Scanner as scanClaudeConfig()
    participant FS as ~/.claude Filesystem
    participant StaticJSON as skills-data.json

    User->>Browser: navigates to app URL
    Browser->>NextServer: GET /

    NextServer->>Scanner: scanClaudeConfig()

    par Parallel filesystem reads
        Scanner->>FS: parseAgents(~/.claude)
        Scanner->>FS: parseSkills(~/.claude)
        Scanner->>FS: parseCommands(~/.claude)
        Scanner->>FS: parseHooks(~/.claude)
        Scanner->>FS: parsePlugins(~/.claude, ./.claude)
    end

    FS-->>Scanner: file contents (or errors → [])
    Scanner->>Scanner: deduplicate each category

    alt hasData (any non-empty array)
        Scanner-->>NextServer: SkillsData from filesystem
    else all empty
        NextServer->>StaticJSON: import static data
        StaticJSON-->>NextServer: SkillsData (bundled)
    end

    NextServer->>NextServer: SSR render SkillsDashboard\nwith data as prop
    NextServer-->>Browser: HTML + RSC payload

    Browser->>Browser: Hydrate SkillsDashboard\n(useState initialised from SSR props)
    Browser-->>User: Interactive dashboard visible
```

---

## 2. Live Rescan

Triggered when the user clicks the **Rescan** button. A client-side fetch hits the API route, which re-runs the scanner.

```mermaid
sequenceDiagram
    actor User
    participant Dash as SkillsDashboard\n(Client Component)
    participant API as /api/scan\n(Route Handler)
    participant Scanner as scanClaudeConfig()
    participant FS as ~/.claude Filesystem

    User->>Dash: clicks "Rescan" button
    Dash->>Dash: setRescanning(true)\nbutton shows spinner + "Scanning"

    Dash->>API: GET /api/scan\n(fetch)

    API->>Scanner: scanClaudeConfig()

    par Parallel filesystem reads
        Scanner->>FS: parseAgents()
        Scanner->>FS: parseSkills()
        Scanner->>FS: parseCommands()
        Scanner->>FS: parseHooks()
        Scanner->>FS: parsePlugins()
    end

    FS-->>Scanner: file contents
    Scanner->>Scanner: deduplicate
    Scanner-->>API: SkillsData

    API-->>Dash: 200 OK + JSON body

    Dash->>Dash: setData(fresh)\nuseState update

    Note over Dash: useMemo recomputes:\n• allItems\n• counts\n• filtered\n• uniqueDomains\n• modelFamilies\nAll derived state updates automatically

    Dash->>Dash: setRescanning(false)
    Dash-->>User: Updated grid renders\nwith fresh data
```

---

## 3. Search Interaction

Real-time search filtering — no debounce, no server call. Pure client-side derived state.

```mermaid
sequenceDiagram
    actor User
    participant Input as Search Input\n(controlled input)
    participant Dash as SkillsDashboard state
    participant Memo as useMemo: filtered

    User->>Input: types "database"
    Input->>Dash: onChange → setSearch("database")

    Dash->>Memo: React re-renders\n"filtered" memo invalidated

    Memo->>Memo: Filter allItems where ANY of:\n• displayName includes "database"\n• description includes "database"\n• domain includes "database"\n• pluginId includes "database"\n• status includes "database"\n• version includes "database"\n• name includes "database"\n• tools[].some includes "database"\n• keywords[].some includes "database"

    Memo-->>Dash: filtered SkillItem[]
    Dash-->>User: Grid updates with matched cards

    User->>Input: clears search ""
    Input->>Dash: setSearch("")
    Dash->>Memo: filtered re-evaluates\n→ full categoryItems (no query)
    Memo-->>Dash: full list
    Dash-->>User: All items visible again
```

---

## 4. Category Filter

Switching tabs changes the category state, which drives `filtered` via `useMemo`.

```mermaid
sequenceDiagram
    actor User
    participant FilterBar as Category Buttons
    participant Dash as SkillsDashboard state
    participant Memo as useMemo: filtered

    Note over User,Memo: Initial: category = "all", 47 items shown

    User->>FilterBar: clicks "Agents" button
    FilterBar->>Dash: setCategory("agent")

    Dash->>Memo: "filtered" memo invalidated

    Memo->>Memo: categoryItems =\nallItems.filter(item => item.type === "agent")
    Note right of Memo: Then apply any active search\non top of categoryItems

    Memo-->>Dash: filtered = agents only
    Dash-->>FilterBar: "Agents" button highlighted (active state)
    Dash-->>User: Grid shows only agent cards\nResult count updates to "N Results"

    User->>FilterBar: clicks "All Items"
    FilterBar->>Dash: setCategory("all")
    Dash->>Memo: categoryItems = allItems\n(no type filter)
    Memo-->>Dash: filtered = all items
    Dash-->>User: Full grid restored
```

---

## 5. Card Expand/Collapse

Each card manages its own local state. Independent of the dashboard.

```mermaid
sequenceDiagram
    actor User
    participant Card as SkillCard\n(Client Component)
    participant Toggle as expanded: boolean

    Note over Card,Toggle: Initial: expanded = false\nDescription truncated at 130 chars\n"Peek" label shown

    User->>Card: clicks card header area
    Card->>Toggle: setExpanded(true)

    Note over Card: CSS grid-rows transitions:\n0fr → 1fr (smooth height animation)\nopacity 0 → 1

    Card-->>User: Full description shown\nTools list rendered\nKeywords list rendered\nSource path rendered\n"Open" label shown\nChevron rotated 180°

    User->>Card: clicks card header again
    Card->>Toggle: setExpanded(false)

    Note over Card: Reverse CSS transition\n1fr → 0fr (collapses)

    Card-->>User: Collapsed view restored
```

---

## 6. Error Paths

```mermaid
sequenceDiagram
    participant Scanner as scanClaudeConfig()
    participant FS as ~/.claude Filesystem
    participant Page as page.tsx
    participant StaticJSON as skills-data.json

    Scanner->>FS: attempt to read agents/, skills/, etc.
    FS-->>Scanner: ENOENT (directory not found)\nor permission denied

    Note over Scanner: Each parser catches errors internally\nreturns [] on any fs error

    Scanner-->>Page: SkillsData { agents: [], skills: [],\ncommands: [], plugins: [], hooks: [] }

    Page->>Page: hasData = false\n(all arrays empty)

    Page->>StaticJSON: import static fallback
    StaticJSON-->>Page: bundled SkillsData

    Note over Page: Dashboard renders with static data\nUser sees sample content\nRescan still available to retry
```
