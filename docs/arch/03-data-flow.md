# 03 — Data Flow

## End-to-End Data Flow

```mermaid
flowchart TD
    A(["Browser Request\nGET /"])

    subgraph Server["Next.js Server (Node.js runtime)"]
        B["page.tsx\nServer Component\nforce-dynamic"]
        C["scanClaudeConfig()\nsrc/lib/scanner/index.ts"]

        subgraph Parsers["Parallel Promise.all()"]
            P1["parseAgents(globalDir)"]
            P2["parseSkills(globalDir)"]
            P3["parseCommands(globalDir)"]
            P4["parseHooks(globalDir)"]
            P5["parsePlugins(globalDir, projectDir)"]
        end

        D["deduplicate(items)\nfor each type"]
        E{"hasData?\nany array non-empty"}
        F["SkillsData from scanner"]
        G["staticData from\nskills-data.json"]
    end

    subgraph FS["~/.claude Filesystem"]
        FS1["agents/*.md"]
        FS2["skills/*/skill.md"]
        FS3["commands/*.md"]
        FS4["hooks/hooks.json"]
        FS5["plugins/cache/**/"]
        FS6["settings*.json"]
    end

    subgraph Client["Browser (Client Component)"]
        H["SkillsDashboard\ninitialData prop hydrated"]
        I["useState(initialData)"]
        J["useMemo: allItems\nflattened array"]
        K["useMemo: filtered\nsearch + category applied"]
        L["SkillCard[]\nrendered grid"]
    end

    A --> B
    B --> C
    C --> Parsers

    P1 -->|"reads"| FS1
    P2 -->|"reads"| FS2
    P3 -->|"reads"| FS3
    P4 -->|"reads"| FS4
    P5 -->|"reads"| FS5
    P5 -->|"reads"| FS6

    Parsers --> D
    D --> E
    E -->|"yes"| F
    E -->|"no (empty)"| G

    F --> H
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
```

---

## Data Shape Transformations

Each parser transforms raw filesystem artifacts into the canonical `SkillItem` type.

### `SkillItem` — Canonical Shape

```mermaid
classDiagram
    class SkillItem {
        +string name
        +string displayName
        +Type type
        +string description
        +string|null model
        +string domain
        +Source source
        +string[] tools
        +string[] keywords
        +string filePath
        +Status status
        +string version
        +string pluginId
    }

    class Type {
        <<enumeration>>
        agent
        skill
        command
        plugin
        hook
    }

    class Source {
        <<enumeration>>
        global
        project
        built-in
    }

    class Status {
        <<enumeration>>
        enabled
        disabled
    }

    class SkillsData {
        +SkillItem[] agents
        +SkillItem[] skills
        +SkillItem[] commands
        +SkillItem[] plugins
        +SkillItem[] hooks
    }

    SkillItem --> Type
    SkillItem --> Source
    SkillItem --> Status
    SkillsData "1" --> "0..*" SkillItem
```

---

## Per-Parser Data Transformation

### Agents (`parse-agents.ts`)

```
~/.claude/agents/<name>.md
  ↓  gray-matter parses YAML frontmatter
  ↓  Extracts: name, description, model, tools
  ↓  Derives displayName via kebab→Title Case
  →  SkillItem { type: "agent", source: "global" }
```

**Frontmatter fields read:**
- `name` (fallback: filename without `.md`)
- `description`
- `model`
- `tools` (array)

### Skills (`parse-skills.ts`)

```
~/.claude/skills/<skill-name>/skill.md   (case-insensitive match)
  ↓  gray-matter parses YAML frontmatter
  ↓  Extracts: name, description, model, tools/allowed-tools
  ↓  tools: splits comma-string OR accepts array
  →  SkillItem { type: "skill", source: "global" }
```

**Frontmatter fields read:**
- `name` (fallback: directory name)
- `description`
- `model`
- `tools` OR `allowed-tools` (string or array)

### Commands (`parse-commands.ts`)

```
~/.claude/commands/<name>.md
  ↓  Raw text parse (no frontmatter)
  ↓  Extracts: H1 heading → displayName
  ↓  First non-header paragraph → description
  ↓  Strips blockquote markers (>)
  →  SkillItem { type: "command", model: null, tools: [] }
```

### Hooks (`parse-hooks.ts`)

```
~/.claude/hooks/hooks.json
  ↓  JSON.parse
  ↓  Each top-level key = event name
  ↓  Extracts: hook types, matchers
  →  SkillItem per event { type: "hook", tools: [] }
```

**JSON structure expected:**
```json
{
  "EventName": [
    {
      "matcher": "optional-pattern",
      "hooks": [{ "type": "shell", "command": "..." }]
    }
  ]
}
```

### Plugins (`parse-plugins.ts`)

```
Reads from two sources concurrently:
  1. settings.json / settings.local.json → enabledPlugins map
  2. ~/.claude/plugins/cache/<marketplace>/<name>/<version>/ → installed map

Merges both maps by pluginId (name@marketplace):
  - enabled but not installed → still listed (disabled or enabled)
  - installed but not in settings → listed as disabled
  - Both → merged with installed metadata taking priority for description/version

Picks latest version by mtime when multiple release dirs exist.
  →  SkillItem { type: "plugin", domain: marketplace, status, version, pluginId }
```

---

## Deduplication Logic

```mermaid
flowchart LR
    A["SkillItem[][]"] --> B["deduplicate(items)"]
    B --> C{{"seen Set<string>"}}
    C --> D["Key = name::type\n(plugins: pluginId::type)"]
    D --> E{{"Has key?"}}
    E -->|"No"| F["Add to seen\nKeep item"]
    E -->|"Yes"| G["Drop duplicate"]
    F --> H["SkillItem[] deduplicated"]
    G --> H
```

The deduplication key for plugins uses `pluginId` (which is `name@marketplace`) rather than just `name` to allow plugins from different marketplaces with the same name to coexist.

---

## Rescan Data Flow

```mermaid
sequenceDiagram
    actor User
    participant Dash as SkillsDashboard (Client)
    participant API as /api/scan (Server)
    participant Scanner as scanClaudeConfig()
    participant FS as ~/.claude

    User->>Dash: clicks Rescan button
    Dash->>Dash: setRescanning(true)
    Dash->>API: fetch GET /api/scan
    API->>Scanner: scanClaudeConfig()
    Scanner->>FS: parallel fs.readdir / fs.readFile
    FS-->>Scanner: file contents
    Scanner-->>API: SkillsData
    API-->>Dash: JSON response
    Dash->>Dash: setData(fresh)
    Dash->>Dash: setRescanning(false)
    Note over Dash: useMemo recomputes allItems,\nfiltered, counts automatically
```

---

## Filter Pipeline

```mermaid
flowchart LR
    A["data: SkillsData\n(state)"]
    B["allItems\nuseMemo\n──────────────\n[...agents,\n ...skills,\n ...commands,\n ...plugins,\n ...hooks]"]
    C["categoryItems\n──────────────\ncategory === 'all'\n? allItems\n: filter by type"]
    D["filtered\nuseMemo\n──────────────\nif !search → categoryItems\nelse → search across:\n• displayName\n• description\n• domain\n• pluginId\n• status\n• version\n• name\n• tools[]\n• keywords[]"]
    E["SkillCard[]\nrendered"]

    A --> B
    B --> C
    C --> D
    D --> E
```
