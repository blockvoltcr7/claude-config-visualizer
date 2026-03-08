---
name: drizzle-database
description: Work with Drizzle ORM, PostgreSQL schema, database migrations, and Supabase. Use when working with database schema, migrations, SQL queries, pgvector, RLS policies, or database operations.
allowed-tools: Read, Grep, Glob, Bash(npm run db:*)
---

# Drizzle ORM Database Skill

## Overview

OS AI uses **Drizzle ORM** for type-safe database operations with **Supabase PostgreSQL**. The database is organized into three PostgreSQL schemas:

| Schema | Purpose | Defined via |
|--------|---------|-------------|
| `public` | Core user identity, API keys | `pgTable(...)` (default) |
| `creator` | Program management domain | `pgSchema("creator").table(...)` |
| `ai` | All AI functionality | `pgSchema("ai").table(...)` |

## Database Architecture

### `public` schema (3 tables + 1 utility)

| Table | File | Purpose |
|-------|------|---------|
| `users` | `users.ts` | Base user accounts (Supabase Auth sync) |
| `user_profiles` | `user_profiles.ts` | Extended user info (bio, preferences) |
| `human_creators` | `human_creators.ts` | Creator profiles (1:1 with users) |
| `api_keys` | `api-keys.ts` | SHA-256 hashed API keys for external auth |

### `creator` schema (5 tables)

All defined in `creator.ts` via `pgSchema("creator")`:

| Table | Purpose |
|-------|---------|
| `creator.programs` | Coaching programs created by creators |
| `creator.onboarding_questions` | Ordered questions for program enrollment |
| `creator.program_enrollments` | User-program enrollment tracking |
| `creator.onboarding_responses` | User answers to onboarding questions |
| `creator.invite_codes` | Invite codes for creator signup |

### `ai` schema (19 tables)

All defined in `ai.ts` via `pgSchema("ai")`:

**AI Infrastructure (2):** `ai.providers`, `ai.models`
**Chat System (2):** `ai.conversations`, `ai.messages`
**RAG Pipeline (3):** `ai.documents`, `ai.document_chunks`, `ai.processing_jobs`
**State Management (4):** `ai.sessions`, `ai.user_states`, `ai.app_states`, `ai.events`
**Admin (1):** `ai.usage_events`
**Agno Framework (6, type defs only):** `ai.agno_sessions`, `ai.agno_schema_versions`, `ai.agno_memories`, `ai.agno_metrics`, `ai.agno_eval_runs`, `ai.agno_knowledge`

> **Note:** Agno tables are managed by the Agno framework. DO NOT modify them via Drizzle migrations.

## Code Locations

### Schema Definitions

```
apps/web/lib/drizzle/schema/
├── users.ts              # public.users
├── user_profiles.ts      # public.user_profiles
├── human_creators.ts     # public.human_creators
├── creator.ts            # creator.* (5 tables, pgSchema("creator"))
├── ai.ts                 # ai.* (19 tables, pgSchema("ai"))
├── api-keys.ts           # public.api_keys
├── enums.ts              # Shared enum documentation (most defined inline)
└── index.ts              # Schema aggregation (all exports)
```

> **Legacy files:** Individual files like `conversations.ts`, `messages.ts`, `documents.ts`, `document_chunks.ts` may exist but are superseded by the consolidated `ai.ts`. The canonical exports come from `index.ts`.

### Configuration

```
apps/web/drizzle.config.ts    # Drizzle Kit config (schema glob, migrations dir)
apps/web/lib/drizzle/db.ts    # Database client setup (postgres-js driver)
```

### Migration Files

```
apps/web/drizzle/migrations/
├── 0053_*.sql              # Earlier migrations
├── ...
├── 0064_*.sql              # Latest migration
├── *.down.sql              # Corresponding down migrations
└── meta/                   # Drizzle metadata (DO NOT edit)
```

## Database Connection

Uses `postgres` (postgres-js) driver with pool configuration:

| Setting | Production | Development |
|---------|-----------|-------------|
| `max` connections | 20 | 10 |
| `idle_timeout` (sec) | 30 | 20 |
| `connect_timeout` (sec) | 10 | 10 |

```typescript
// apps/web/lib/drizzle/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL, { max: 20, ... });
export const db = drizzle(client, { schema });
```

## Migration Workflows

### Approach 1: Drizzle CLI (schema-driven)

Best for schema changes that map to Drizzle table definitions.

**Step 1:** Update schema file (e.g., add column to `users.ts`)
**Step 2:** Generate migration:
```bash
npm run db:generate        # Local (uses .env.local)
npm run db:generate:staging  # Staging
npm run db:generate:prod     # Production
```
**Step 3:** Review the generated SQL in `apps/web/drizzle/migrations/XXXX_*.sql`
**Step 4:** Create a corresponding `.down.sql` file for rollback
**Step 5:** Apply migration:
```bash
npm run db:migrate         # Local
npm run db:migrate:staging   # Staging
npm run db:migrate:prod      # Production
```

### Approach 2: Custom SQL Migration

Best for raw SQL that Drizzle can't express (RPC functions, complex ALTER statements, GIN indexes).

```bash
npm run db:generate:custom   # Creates empty timestamped .sql file
# Edit the generated file with your SQL
npm run db:migrate           # Apply
```

### Approach 3: Supabase MCP (direct SQL)

Best for quick schema changes or when you want immediate application without file generation.

Use the `apply_migration` MCP tool to execute SQL directly against the database. Then update the corresponding Drizzle schema file to keep TypeScript types in sync.

> **Important:** After using Supabase MCP, always update the Drizzle schema files to match the applied changes. Otherwise `db:generate` will produce drift migrations.

## Down Migrations & Rollback

### Creating Down Migrations

For every `XXXX_name.sql`, create a `XXXX_name.down.sql` in the same directory with the inverse operations.

### Rollback

```bash
npm run db:rollback          # Rollback last migration (local)
npm run db:rollback:staging  # Staging
npm run db:rollback:prod     # Production
```

The rollback script has a **5-second countdown** before executing. It:
1. Finds the latest applied migration
2. Looks for a matching `.down.sql` file
3. Executes the down SQL
4. Removes the migration record from `drizzle.__drizzle_migrations`

## Multi-Environment Workflow

All database scripts use `dotenv-cli` to load environment-specific variables:

| Environment | Env File | Script Suffix |
|------------|----------|---------------|
| Local | `.env.local` | (none) |
| Staging | `.env.staging` | `:staging` |
| Production | `.env.prod` | `:prod` |

**Pattern:** `npx dotenv-cli -e .env.{env} -- {command}`

**Workflow:**
1. Develop and test locally (`.env.local`)
2. Apply to staging for QA (`.env.staging`)
3. Apply to production during off-peak hours (`.env.prod`)

## Complete npm Scripts

### Development & Build

| Script | Command |
|--------|---------|
| `npm run dev` | `next dev --turbopack` |
| `npm run dev:full` | Dev + Stripe webhook listener |
| `npm run build` | `next build` |
| `npm run start` | `next start` |
| `npm run lint` | `eslint .` |
| `npm run format` | `prettier --write .` |
| `npm run type-check` | `tsc --noEmit` |

### Migration Generation

| Script | Environment |
|--------|------------|
| `npm run db:generate` | Local |
| `npm run db:generate:staging` | Staging |
| `npm run db:generate:prod` | Production |
| `npm run db:generate:custom` | Local (empty SQL file) |
| `npm run db:generate:custom:staging` | Staging (empty SQL file) |
| `npm run db:generate:custom:prod` | Production (empty SQL file) |

### Migration Application

| Script | Environment |
|--------|------------|
| `npm run db:migrate` | Local |
| `npm run db:migrate:staging` | Staging |
| `npm run db:migrate:prod` | Production |

### Rollback

| Script | Environment |
|--------|------------|
| `npm run db:rollback` | Local |
| `npm run db:rollback:staging` | Staging |
| `npm run db:rollback:prod` | Production |

### Status

| Script | Environment |
|--------|------------|
| `npm run db:status` | Local |
| `npm run db:status:staging` | Staging |
| `npm run db:status:prod` | Production |

### Seeding

| Script | Purpose |
|--------|---------|
| `npm run db:seed:ai` | Seed AI providers and models (local) |
| `npm run db:seed:ai:staging` | Seed AI providers and models (staging) |
| `npm run db:seed:ai:prod` | Seed AI providers and models (prod) |
| `npm run db:seed:programs` | Seed program data (local) |
| `npm run db:seed:programs:staging` | Seed program data (staging) |
| `npm run db:seed:programs:prod` | Seed program data (prod) |

### API Keys & Verification

| Script | Purpose |
|--------|---------|
| `npm run db:generate-api-key` | Generate API key (local) |
| `npm run db:generate-api-key:staging` | Generate API key (staging) |
| `npm run db:generate-api-key:prod` | Generate API key (prod) |
| `npm run db:verify-schema` | Verify schema matches DB (local) |
| `npm run db:verify-trigger` | Verify triggers exist (local) |

### Storage & Utilities

| Script | Purpose |
|--------|---------|
| `npm run storage:setup` | Setup Supabase storage buckets (local) |
| `npm run storage:setup:staging` | Setup storage buckets (staging) |
| `npm run storage:setup:prod` | Setup storage buckets (prod) |
| `npm run open:claude` | Open Claude JSON config |

## Query Examples

### Using pgSchema Tables

```typescript
import { db } from "@/lib/drizzle/db";
import { programs, programEnrollments } from "@/lib/drizzle/schema/creator";
import { documents, documentChunks } from "@/lib/drizzle/schema/ai";
import { eq, and, inArray } from "drizzle-orm";

// Insert into creator schema
const newProgram = await db.insert(programs).values({
  creatorId: creatorId,
  programName: "My Program",
  description: "Description",
  programSlug: "my-program",
}).returning();

// Query across schemas (creator + ai)
const docs = await db
  .select()
  .from(documents)
  .where(and(
    eq(documents.creatorId, creatorId),
    eq(documents.programId, programId)
  ));
```

### Vector Similarity Search

```typescript
import { sql } from "drizzle-orm";

// Text embedding: 3072 dimensions (Vertex AI text-embedding-005)
// Multimodal embedding: 1408 dimensions (Vertex AI multimodal-embedding-001)

const similarChunks = await db
  .select()
  .from(documentChunks)
  .where(and(
    eq(documentChunks.creatorId, creatorId),
    eq(documentChunks.programId, programId)
  ))
  .orderBy(sql`text_embedding <=> ${queryEmbedding}`)
  .limit(5);
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  const doc = await tx.insert(documents).values({...}).returning();
  await tx.insert(documentChunks).values({
    documentId: doc[0].id,
    content: "chunk text",
    creatorId: creatorId,
    programId: programId,
  });
});
```

## Best Practices

### Schema Design
- **UUIDs** for primary keys (distributed-system friendly)
- **Timestamps** with timezone: `createdAt` and `updatedAt` on all tables
- **Creator scoping**: Include `creator_id` and `program_id` for multi-tenancy isolation
- **Indexes**: On foreign keys, frequently filtered columns, and composite (creator + program)

### Type-Safe Operators (CRITICAL)

**NEVER** use raw SQL for operations with type-safe alternatives (per CLAUDE.md):

```typescript
import { inArray, eq, and, or, like } from "drizzle-orm";

// CORRECT
db.select().from(users).where(inArray(users.id, userIds));
db.select().from(users).where(eq(users.email, email));

// WRONG - raw SQL fragments
db.select().from(users).where(sql`${users.id} = ANY(${userIds})`);
```

**Only use `sql` template for:** vector operations (`<=>` operator), complex PostgreSQL functions (`ts_rank`, `gen_random_uuid`), database functions not supported by Drizzle.

### Migration Safety Checklist
- [ ] Test migration locally first (`npm run db:migrate`)
- [ ] Review generated SQL before applying
- [ ] Create `.down.sql` rollback file
- [ ] Test rollback locally (`npm run db:rollback`)
- [ ] Apply to staging (`npm run db:migrate:staging`)
- [ ] Verify staging behavior
- [ ] Apply to production during off-peak hours (`npm run db:migrate:prod`)
- [ ] Run Supabase security advisors after production changes

### Security
- **RLS policies**: Enable on all user-facing tables
- **Creator isolation**: Filter queries by `creator_id` and `program_id`
- **Input validation**: Validate user inputs before DB operations
- **Parameterized queries**: Drizzle handles this automatically
- **Service role**: Use sparingly, prefer user-scoped queries

## Troubleshooting

### Issue: pgvector dimension mismatch
**Solution**: Text embeddings use **3072** dimensions (`text-embedding-005`), multimodal embeddings use **1408** dimensions (`multimodal-embedding-001`). Check `TEXT_EMBEDDING_DIMENSIONS` and `MULTIMODAL_EMBEDDING_DIMENSIONS` constants in `ai.ts`.

### Issue: "relation does not exist"
**Solution**: Check schema prefix. Tables in `creator` and `ai` schemas need the schema qualifier in raw SQL (e.g., `creator.programs`, `ai.documents`). Drizzle handles this automatically via `pgSchema()`.

### Issue: Migration drift after Supabase MCP changes
**Solution**: After applying SQL via Supabase MCP, update the Drizzle schema files to match. Run `npm run db:generate` to verify no unexpected migrations are generated.

### Issue: Slow queries
**Solution**: Use `EXPLAIN ANALYZE` to profile. Check for missing indexes, especially composite indexes on `(creator_id, program_id)`. All RAG queries should use HNSW indexes for vector search.

### Issue: Migration fails with constraint error
**Solution**: Check foreign key references across schemas. `creator.programs.creator_id` references `public.human_creators.id`. Ensure parent records exist before inserting.

### Issue: Rollback not finding down file
**Solution**: Down migrations must be named `XXXX_name.down.sql` matching the up migration `XXXX_name.sql` exactly (same prefix number and name).

## Reference Documentation

- Drizzle ORM Docs: https://orm.drizzle.team/
- Drizzle pgSchema: https://orm.drizzle.team/docs/schemas
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Supabase Docs: https://supabase.com/docs
- pgvector: https://github.com/pgvector/pgvector
