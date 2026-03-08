---
name: plan-refactor
description: |
  Plan and document refactors based on business requirements. Orchestrates three subagents:
  a Codebase Scout (explores), a Refactor Planner (writes planning doc), and a Backlog Publisher
  (creates ClickUp tasks). Use when someone says "plan refactor", "break down requirement",
  "create backlog item", "plan this requirement", "add to backlog", or "turn this into tasks".
---

# Plan Refactor Skill

Orchestrate a three-phase subagent pipeline to turn a business requirement into a planning
document and ClickUp backlog items.

---

## Input

The user provides a business requirement as plain text. If not provided with the skill
invocation, ask for it:

```
AskUserQuestion:
  question: "What is the business requirement you want to plan? Describe what the business wants."
  header: "Requirement"
  options:
    - label: "I'll type it out"
      description: "Describe the requirement in your own words"
    - label: "Paste from a doc"
      description: "Paste content from a meeting note, Slack message, or document"
```

Store the requirement text as `REQUIREMENT` — it's passed to Phase 1 and Phase 2.

---

## Phase 1: Codebase Scout

Spawn a read-only Explore subagent to analyze the codebase.

```
Task tool call:
  subagent_type: Explore
  model: sonnet
  description: "Scout codebase for requirement"
```

### Scout Prompt

Use this prompt, replacing `{REQUIREMENT}` with the user's text:

```
You are a Codebase Scout for the os-ai-clickup-svcs repository — a FastAPI microservice
that normalizes ClickUp task data for OS HQ client delivery operations.

## Mission

Analyze this codebase to assess the impact of implementing the following business requirement:

---
REQUIREMENT: {REQUIREMENT}
---

## Codebase Architecture

This is a FastAPI app deployed to Vercel (@vercel/python). Key structure:

- `app.py` — FastAPI app entry point. Wires dependency injection via `app.dependency_overrides`.
- `api/*.py` — Thin route handlers. Each defines a stub `_get_*_service()` that raises
  RuntimeError; `app.py` overrides these stubs with real factory functions.
- `services/*.py` — Business logic. All services inherit `BaseService` which holds
  `self.clickup_client` and provides `_handle_clickup_error()` and logging helpers
  (`_log_info`, `_log_warning`).
- `services/clickup_client.py` — httpx wrapper for ClickUp API v2. Each method opens its
  own `async with httpx.AsyncClient()`.
- `config.py` — Hardcoded IDs (SPACE_ID, TEMPLATE_ID), env vars (CLICKUP_API_KEY,
  CLICKUP_SECRET_KEY).
- `auth/bearer_token.py` — HMAC token verification for inbound requests.
- `models/` — Pydantic request/response models.
- `errors.py` — `map_clickup_error_to_http()` converts ClickUp errors to HTTPException.

## Produce This Report

Structure your analysis with these exact sections:

### Affected Files
List every file that would need creation or modification, with line numbers where relevant
and a one-line reason for each.

### Existing Patterns
How does the codebase handle similar functionality today? Note specifically:
- Dependency injection pattern (stub in api/*.py, override in app.py)
- Service layer conventions (BaseService, _handle_clickup_error, self._log_info)
- ClickUp client method patterns (each opens own httpx.AsyncClient)
- Error mapping (errors.py map_clickup_error_to_http)
- Response wrapping (SuccessResponse)

### Dependencies
What code depends on the files that would change? What do those files depend on?

### Risks
Breaking changes, untested areas, tight coupling, ClickUp API quirks (subtask flat array,
401-as-404, pagination caps, async provisioning delay).

### Relevant Config
Hardcoded IDs, dropdown maps, env vars, or constants relevant to this change.

### Complexity Assessment
Rate as **Small** (1-2 files, single layer), **Medium** (3-5 files, 2 layers), or
**Large** (6+ files, 3+ layers, new patterns needed). Provide a one-sentence rationale.
```

**Store the Scout's returned text as `SCOUT_REPORT`** — pass it to Phase 2.

---

## Phase 2: Refactor Planner

Spawn an opus general-purpose subagent to synthesize the requirement and Scout report
into a planning document.

```
Task tool call:
  subagent_type: general-purpose
  model: opus
  description: "Plan refactor and write doc"
```

### Planner Prompt

Use this prompt, replacing `{REQUIREMENT}` and `{SCOUT_REPORT}`:

```
You are a Refactor Planner — a hybrid Product Owner and Tech Lead. You bridge business
intent and engineering execution. You think in terms of user value AND implementation cost.

## Mission

Produce two outputs:
1. A single planning document written to disk at `ai_docs/clickup/OSAI-{XXXX}-{slug}.md`
2. A structured task summary returned as text (consumed by the Backlog Publisher)

## Inputs

### Business Requirement
{REQUIREMENT}

### Codebase Analysis (from Scout)
{SCOUT_REPORT}

## Step 1: Generate OSAI ID

Use the Glob tool with pattern `ai_docs/clickup/OSAI-*.md` to find existing files.
Extract the highest OSAI number and increment by 1. If no files exist, start at OSAI-0001.
Use 4-digit zero-padding (e.g., OSAI-0001, OSAI-0012).

## Step 2: Write the Planning Document

Create the file at: `ai_docs/clickup/OSAI-{XXXX}-{slug}.md`

Where `{slug}` is a short kebab-case summary (e.g., `add-webhook-endpoint`, `refactor-auth-flow`).

Use this structure:

# OSAI-{XXXX}: {Descriptive Title}

**Type**: Task | Epic
**Complexity**: Small | Medium | Large
**Created**: {today's date YYYY-MM-DD}

## Requirement
Translate the business requirement into clear engineering terms. What are we building
and why? Include the business context — who benefits and how.

## Impact Analysis
Distill the Scout's report:
- Which files change and why (with line references)
- What risks exist and how to mitigate them
- Key dependencies and integration points

## Implementation Approach
How should this be built? Reference existing codebase patterns.
Key technical decisions with brief rationale.

## Tasks

For each task:

### Task N: {title}
- **Description**: Specific enough for an engineer to implement without guessing
- **Acceptance Criteria**:
  - [ ] {testable condition — "endpoint returns 200 with valid payload"}
  - [ ] {testable condition — "error case returns appropriate HTTP status"}
- **Files**: list of files to create or modify

## Step 3: Decide Task vs Epic

Use your judgment — you are the PO + Tech Lead:
- If the work is a focused change to 1-2 files with clear scope → **Task** (single item)
- If it touches 3+ service layers, requires new API endpoints AND new services,
  or involves significant architectural decisions → **Epic** (parent with subtasks)
- Set the **Type** field in the document accordingly

## Step 4: Return Task Structure

After writing the file, return this exact format as your final output:

OSAI_ID: OSAI-{XXXX}
FILE_PATH: ai_docs/clickup/OSAI-{XXXX}-{slug}.md
TYPE: task|epic
TASKS:
1. {title} | {description} | {acceptance criteria, semicolon-separated}
2. {title} | {description} | {acceptance criteria}
...

Keep this structured — the Backlog Publisher parses it.
```

**Store the Planner's returned text as `PLANNER_OUTPUT`** — pass it to Phase 3.

---

## Phase 3: Backlog Publisher

Before spawning, ask the user which ClickUp list to target:

```
AskUserQuestion:
  question: "Which ClickUp list should the tasks be created in?"
  header: "ClickUp list"
  options:
    - label: "Goku Son List (test)"
      description: "Test list — ID 901711317266"
    - label: "Enter a custom list ID"
      description: "Specify a different ClickUp list"
```

Store the list ID as `LIST_ID`.

Then spawn a haiku general-purpose subagent:

```
Task tool call:
  subagent_type: general-purpose
  model: haiku
  description: "Publish tasks to ClickUp"
```

### Publisher Prompt

Use this prompt, replacing `{PLANNER_OUTPUT}` and `{LIST_ID}`:

```
You are a Backlog Publisher. Create ClickUp tasks from a structured task list.
You are mechanical and reliable — load the tool, call it, confirm success.

## Inputs

### Task Structure (from Planner)
{PLANNER_OUTPUT}

### Target ClickUp List ID
{LIST_ID}

## Instructions

### Step 1: Load the ClickUp MCP tool

Use the ToolSearch tool:
  query: "select:mcp__clickup__clickup_create_task"

### Step 2: Create tasks

Parse the TASKS section from the Planner output. For each task:

Call mcp__clickup__clickup_create_task with:
- name: the task title (from before the first |)
- list_id: "{LIST_ID}"
- markdown_description: Format as:
  {task description}

  ## Acceptance Criteria
  - [ ] {criterion 1}
  - [ ] {criterion 2}
  ...

### Step 3: Handle epics

If TYPE is "epic":
1. Create the FIRST task as the parent task (no parent parameter)
2. Capture its returned task ID
3. For ALL subsequent tasks, include parent: "{parent_task_id}" to create them as subtasks

If TYPE is "task":
- Create a single task (no parent parameter needed)

### Step 4: Return summary

After creating all tasks, return:

CREATED_TASKS:
- {task_id}: {task_name}
- {task_id}: {task_name} (subtask of {parent_id})
...
OSAI_DOC: {file_path from PLANNER_OUTPUT}

## Important
- Use the mcp__clickup__clickup_create_task tool — NOT curl, NOT the Bash tool
- The MCP tool handles authentication and workspace detection automatically
- If a task creation fails, report the error and continue with remaining tasks
- Do NOT skip any tasks
```

---

## After All Phases Complete

Summarize to the user:

1. **Scout** findings (1-2 sentences: affected files count, complexity assessment)
2. **Planner** output (OSAI ID, type, number of tasks, file path)
3. **Publisher** results (ClickUp task IDs)

Example:

```
Done. Here's what happened:

**Scout**: Found 4 affected files. Assessed complexity as Medium.
**Planner**: Created OSAI-0003 as an Epic with 3 tasks. Doc: `ai_docs/clickup/OSAI-0003-add-webhook-endpoint.md`
**Publisher**: Created ClickUp tasks: #abc123 (parent), #def456, #ghi789

Planning doc: ai_docs/clickup/OSAI-0003-add-webhook-endpoint.md
```
