# 06 — Scanner Module

The scanner (`src/lib/scanner/`) is the core server-side subsystem. It reads the local Claude Code configuration from the filesystem and normalises everything into the `SkillsData` shape. It runs inside Next.js Server Components and Route Handlers — never in the browser.

---

## Module Structure

```
src/lib/scanner/
├── index.ts           ← Orchestrator. Calls direct parsers, scans enabled plugin bundles, deduplicates.
├── parse-agents.ts    ← Reads ~/.claude/agents/*.md  (gray-matter frontmatter)
├── parse-skills.ts    ← Reads ~/.claude/skills/*/skill.md  (gray-matter frontmatter)
├── parse-commands.ts  ← Reads ~/.claude/commands/*.md  (plain text extraction)
├── parse-hooks.ts     ← Reads ~/.claude/hooks/hooks.json  (JSON)
└── parse-plugins.ts   ← Reads settings.json files + ~/.claude/plugins/cache/
```

---

## Orchestrator — `index.ts`

```mermaid
flowchart TD
    ENTRY["scanClaudeConfig()"]

    PATHS["Resolve directories\n─────────────────────\nglobalDir = ~/.claude\nprojectDir = CWD/.claude"]

    PARALLEL["Promise.all() — runs concurrently"]

    P1["parseAgents(globalDir, 'global')"]
    P2["parseSkills(globalDir, 'global')"]
    P3["parseCommands(globalDir, 'global')"]
    P4["parseHooks(globalDir, 'global')"]
    P5["parsePluginInventory(globalDir, projectDir)"]
    P6["scan enabled plugin bundle dirs\nwith parseAgents/parseSkills/\nparseCommands/parseHooks"]

    DEDUP["deduplicate(agents)\ndeduplicate(skills)\ndeduplicate(commands)\ndeduplicate(plugins)\ndeduplicate(hooks)"]

    RETURN["return SkillsData"]

    ERR["catch (any unhandled error)\nreturn empty SkillsData"]

    ENTRY --> PATHS
    PATHS --> PARALLEL
    PARALLEL --> P1
    PARALLEL --> P2
    PARALLEL --> P3
    PARALLEL --> P4
    PARALLEL --> P5
    P5 --> P6
    P1 & P2 & P3 & P4 & P5 & P6 --> DEDUP
    DEDUP --> RETURN
    ENTRY -.->|"try/catch"| ERR
```

**Deduplication key:**
- Standard items: `"${item.name}::${item.type}"`
- Plugins: `"${item.pluginId}::plugin"` (pluginId = `name@marketplace`)
- Plugin-origin items: `"${item.pluginId}::${item.name}::${item.type}"`

---

## Parser: `parse-agents.ts`

Reads every `.md` file inside `<dir>/agents/`, parses YAML frontmatter via `gray-matter`, and maps each file to a `SkillItem`.

```mermaid
flowchart TD
    START["parseAgents(dir, source)"]
    READ_DIR["fs.readdir(<dir>/agents/)"]
    FILTER[".filter(f => f.endsWith('.md'))"]
    LOOP["for each .md file"]
    READ_FILE["fs.readFile(path, 'utf-8')"]
    PARSE["matter(raw) → { data }"]
    MAP["SkillItem {\n  name: data.name ?? filename\n  displayName: kebab→TitleCase\n  type: 'agent'\n  description: data.description\n  model: data.model\n  tools: data.tools[]\n  source, filePath\n}"]
    SKIP["catch → skip file"]
    RETURN["return SkillItem[]"]

    START --> READ_DIR
    READ_DIR -->|"ENOENT → []"| RETURN
    READ_DIR --> FILTER
    FILTER --> LOOP
    LOOP --> READ_FILE
    READ_FILE --> PARSE
    PARSE --> MAP
    MAP --> LOOP
    READ_FILE & PARSE -->|"error"| SKIP
    SKIP --> LOOP
    LOOP -->|"done"| RETURN
```

**Expected frontmatter:**
```yaml
---
name: my-agent
description: Does something useful
model: sonnet
tools:
  - Read
  - Write
  - Bash
---
```

---

## Parser: `parse-skills.ts`

Skills are stored in *directories*, not single files. Each skill lives at `<dir>/skills/<skill-name>/skill.md` (case-insensitive match for `skill.md` / `SKILL.md`).

```mermaid
flowchart TD
    START["parseSkills(dir, source)"]
    READ_DIR["fs.readdir(<dir>/skills/)"]
    LOOP_ENTRIES["for each entry"]
    STAT["fs.stat(entry)\nis directory?"]
    LIST_DIR["fs.readdir(entryPath)\nfind skill.md (case-insensitive)"]
    READ_FILE["fs.readFile(skill.md)"]
    PARSE["matter(raw) → { data }"]
    TOOLS["Resolve tools:\ndata['allowed-tools'] ?? data.tools\n─────────────────────────\nstring → split(',').map(trim)\narray → use directly"]
    MAP["SkillItem {\n  name: data.name ?? dirname\n  type: 'skill'\n  tools: resolved tools\n  source, filePath\n}"]
    SKIP["catch → skip entry"]
    RETURN["return SkillItem[]"]

    START --> READ_DIR
    READ_DIR -->|"ENOENT → []"| RETURN
    READ_DIR --> LOOP_ENTRIES
    LOOP_ENTRIES --> STAT
    STAT -->|"not directory"| LOOP_ENTRIES
    STAT -->|"is directory"| LIST_DIR
    LIST_DIR -->|"no skill.md found"| LOOP_ENTRIES
    LIST_DIR --> READ_FILE
    READ_FILE --> PARSE
    PARSE --> TOOLS
    TOOLS --> MAP
    MAP --> LOOP_ENTRIES
    READ_FILE & PARSE -->|"error"| SKIP
    SKIP --> LOOP_ENTRIES
    LOOP_ENTRIES -->|"done"| RETURN
```

**Dual tools field support:** Skills from different plugin systems may use `tools` or `allowed-tools` as the frontmatter key. The parser accepts either.

---

## Parser: `parse-commands.ts`

Commands are plain markdown files without YAML frontmatter. The parser extracts the title from the H1 heading and the description from the first non-empty paragraph.

```mermaid
flowchart TD
    START["parseCommands(dir, source)"]
    READ_DIR["fs.readdir(<dir>/commands/)"]
    FILTER[".filter(f => f.endsWith('.md'))"]
    LOOP["for each .md file"]
    READ_FILE["fs.readFile(path)"]
    EXTRACT_TITLE["Regex: /^#\\s+(.+)$/m\n→ displayName (fallback: filename)"]
    EXTRACT_DESC["Line scan:\n• Skip H1, empty lines, '---'\n• foundContent = true on first content line\n• Accumulate until blank line\n• Strip blockquote markers (>)"]
    MAP["SkillItem {\n  name: filename (no .md)\n  displayName: from H1\n  description: first paragraph\n  type: 'command'\n  model: null, tools: []\n}"]
    RETURN["return SkillItem[]"]

    START --> READ_DIR
    READ_DIR -->|"ENOENT → []"| RETURN
    READ_DIR --> FILTER
    FILTER --> LOOP
    LOOP --> READ_FILE
    READ_FILE --> EXTRACT_TITLE
    EXTRACT_TITLE --> EXTRACT_DESC
    EXTRACT_DESC --> MAP
    MAP --> LOOP
    LOOP -->|"done"| RETURN
```

---

## Parser: `parse-hooks.ts`

Reads `<dir>/hooks/hooks.json`, which is a JSON object where each key is an event name and each value is an array of hook entries.

```mermaid
flowchart TD
    START["parseHooks(dir, source)"]
    READ["fs.readFile(<dir>/hooks/hooks.json)"]
    PARSE["JSON.parse(raw)"]
    LOOP["for each [eventName, entries]"]
    COLLECT["hookTypes = entries\n  .flatMap(e => e.hooks)\n  .map(h => h.type)"]
    MATCHER["matchers = entries\n  .map(e => e.matcher)\n  .filter(Boolean)"]
    DESC["description =\nmatchers.length\n? 'Matcher: {matchers} ({typeSummary})'\n: typeSummary"]
    MAP["SkillItem {\n  name: eventName\n  displayName: eventName\n  type: 'hook'\n  description\n  tools: []\n}"]
    RETURN["return SkillItem[]"]

    START --> READ
    READ -->|"ENOENT → []"| RETURN
    PARSE -->|"invalid JSON → []"| RETURN
    READ --> PARSE
    PARSE --> LOOP
    LOOP --> COLLECT
    COLLECT --> MATCHER
    MATCHER --> DESC
    DESC --> MAP
    MAP --> LOOP
    LOOP -->|"done"| RETURN
```

**Expected `hooks.json` structure:**
```json
{
  "PostToolUse": [
    {
      "matcher": "Bash",
      "hooks": [{ "type": "shell", "command": "echo done" }]
    }
  ],
  "PreToolUse": [
    {
      "hooks": [{ "type": "prompt", "prompt": "Check for issues" }]
    }
  ]
}
```

---

## Parser: `parse-plugins.ts`

The most complex parser. It merges two independent data sources to produce a unified plugin list.

```mermaid
flowchart TD
    START["parsePluginInventory(globalDir, projectDir)"]

    subgraph Concurrent["Promise.all()"]
        ENABLED["parseEnabledPlugins()\n────────────────────\nReads from:\n• globalDir/settings.json\n• globalDir/settings.local.json\n• projectDir/settings.json\n• projectDir/settings.local.json\n\nLater files override earlier\n(last-write-wins precedence)\n\nExtract: enabledPlugins object\n→ Map<pluginId, {enabled, source, filePath}>"]

        INSTALLED["parseInstalledPlugins()\n────────────────────\nReads: globalDir/plugins/cache/\n  <marketplace>/\n    <plugin-name>/\n      <release-dir>/    ← picks latest by mtime\n        .claude-plugin/plugin.json\n        README.md\n\n→ Map<pluginId, InstalledPluginMeta>"]
    end

    MERGE["Union of pluginIds from both Maps"]
    LOOP["for each pluginId"]
    STATUS["status = enabledConfig.enabled\n? 'enabled' : 'disabled'"]
    META["description from:\n1. plugin.json description\n2. README.md first paragraph\n3. Fallback: 'PluginName plugin'"]
    COUNTS["pluginCounts from selected release:\n• parseable skills/\n• commands/*.md\n• agents/*.md\n• hook events"]
    KEYWORDS["keywords = [\n  ...plugin.json keywords,\n  marketplace,\n  status,\n  version\n]"]
    SORT["Sort: enabled first,\nthen alphabetical by displayName"]
    RETURN["return { enabledPlugins,\ninstalledPlugins,\nitems }"]

    START --> Concurrent
    ENABLED & INSTALLED --> MERGE
    MERGE --> LOOP
    LOOP --> STATUS
    STATUS --> META
    META --> COUNTS
    COUNTS --> KEYWORDS
    KEYWORDS --> LOOP
    LOOP -->|"done"| SORT
    SORT --> RETURN
```

### Plugin Identity Parsing

Plugin IDs use the format `name@marketplace`. The `parsePluginIdentity()` function handles edge cases:

```
"superpowers@claude-plugins-official"
  → name: "superpowers", marketplace: "claude-plugins-official"

"my-plugin"   (no @)
  → name: "my-plugin", marketplace: "unknown"

"@scoped/pkg@registry"  (@ appears in name)
  → splits at the LAST @ to handle scoped names
```

### Version Selection

When a plugin has multiple release directories (e.g. `1.0.0`, `1.2.0`, `2.0.0`), the parser selects the **most recently modified** one by comparing `fs.stat().mtimeMs`. This means the live installed version is always shown, even if older versions remain in the cache directory.

### Enabled Bundle Materialization

After plugin inventory is loaded, the orchestrator performs a second pass:

- Only plugins with `enabled === true` are scanned for bundled items.
- Each enabled plugin must also have an installed `releasePath`.
- The existing parsers are run against that release root, so plugin bundles reuse the same parsing logic as top-level config directories.
- Returned items are annotated with plugin provenance (`pluginId`, `pluginDisplayName`, `pluginVersion`) and preserve the plugin enablement scope (`global` or `project`) as their `source`.

---

## Error Handling Strategy

The scanner follows a **fail-safe, never-throw** design:

| Failure point | Behaviour |
|---|---|
| Directory not found (`ENOENT`) | Parser returns `[]` immediately |
| File read error | Individual file is skipped, loop continues |
| Malformed frontmatter | `gray-matter` may return empty `data`; defaults applied |
| Invalid JSON (hooks/settings) | `JSON.parse` failure caught, returns `[]` |
| Any unhandled exception in `scanClaudeConfig()` | Outer `try/catch` returns fully empty `SkillsData` |

This ensures the dashboard always renders — worst case, it falls back to the static JSON dataset.

---

## Performance Characteristics

- **Parallelism:** All five parsers run concurrently via `Promise.all()`. I/O bound by filesystem speed.
- **Plugin cache scan:** Nested directory traversal (`marketplace → plugin → release`). `Promise.all` is NOT used inside the loop (sequential per-plugin), but the outer call is concurrent with other parsers.
- **Re-entrant safe:** Each call to `scanClaudeConfig()` is fully independent with no shared mutable state.
- **No caching:** Every page request and `/api/scan` call reads fresh from disk. Appropriate for a developer tool where the config may change at any time.
