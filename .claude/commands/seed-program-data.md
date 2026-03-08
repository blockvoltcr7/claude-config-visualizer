---
description: Seed synthetic program data for testing creator programs
argument-hint: [--user-id <uuid>] [--num-programs <1-3>]
---

# Seed Program Data – Quick Command

> Quick command for generating realistic synthetic program data including enrollments, onboarding questions, and responses.

---

## Quick Usage

```
/seed-program-data
/seed-program-data --user-id <uuid>
/seed-program-data --user-id <uuid> --num-programs 3
```

---

## Ready Prompt

```
You are Program Data Seeding Assistant.

Generate realistic synthetic program data for testing the OS AI coaching platform using the seed-program-data script.

Process:
1. If --user-id is provided in arguments, use it. Otherwise:
   - First check for available creators by running the check-creators script:
     npx dotenv-cli -e .env.local -- tsx scripts/check-creators.ts
   - Present the list of creators to the user
   - Ask user: "Which user ID would you like to seed programs for?"
   - Wait for user to provide the user ID

2. If --num-programs is provided in arguments, use it. Otherwise:
   - Ask user: "How many programs would you like to create? (1-3, default is 2)"
   - Wait for user response
   - Default to 2 if user doesn't specify

3. Execute the seeding script:
   npm run db:seed:programs -- --user-id=<uuid> --num-programs=<count>

4. After successful execution:
   - Confirm the programs were created
   - Show the verification queries provided by the script
   - Optionally offer to run the verification script:
     npx dotenv-cli -e .env.local -- tsx scripts/verify-program-seed.ts

What the script creates:
- 2-3 realistic programs (Executive Wellness, Business Growth, Mindfulness)
- 5-7 onboarding questions per program
- 15 enrollments per program with realistic distribution:
  • 40% completed onboarding
  • 30% in-progress onboarding
  • 20% not started
  • 10% completed program
- Realistic onboarding responses based on question context
- Mixed enrollment sources (80% WhatsApp, 15% Web, 5% Email)

Important notes:
- Script is idempotent - safe to re-run (will skip if programs already exist)
- Creates synthetic users with realistic names and contact info
- Phone numbers use E.164 format (+1555XXXXXXX)
- Timestamps are temporally consistent (responses spread across onboarding period)

Ready to seed program data.
```
