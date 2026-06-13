# AI_USAGE.md - AI Tool Usage Log

This document records the AI tools, key prompts, and code correction cycles during the design and development of the Shared Expenses App.

---

## 1. AI Tools Used

- **AI Assistant**: Gemini 3.5 Flash (Medium) via Antigravity IDE.
- **Role**: Pair programmer, database architect, and code reviewer.

---

## 2. Key Prompts & Iterations

### Initial Schema Design Prompt:
> "Build a production-ready full-stack application. Stack: React + Vite + Tailwind, Node.js + Express, PostgreSQL + Prisma. Generate folder structure and Prisma schema only. Do not generate UI yet."

---

## 3. Concrete AI Corrections

During schema and structure generation, the following issues were caught and corrected:

1. **Incorrect SQLite vs. PostgreSQL Syntax**:
   - *AI Output*: Initially, the AI proposed schema definitions without specific decimal precision annotations or using SQLite syntax for relations.
   - *How it was caught*: Cross-referenced with the PostgreSQL requirement and the need for absolute decimal accuracy for financial transactions (avoiding float precision bugs).
   - *What was changed*: Added `@db.Decimal(12, 4)` to all transaction and split amount fields to enforce exact database-level precision.

2. **Neglecting Dynamic Memberships**:
   - *AI Output*: The initial draft used simple many-to-many implicit user-group relations.
   - *How it was caught*: Checked against Sam's ("I moved in mid-April. Why would March electricity affect my balance?") and Meera's timelines. If a member left or joined, a standard many-to-many relation would either apply splits retroactively or block addition.
   - *What was changed*: Replaced the implicit many-to-many relation with a formal `GroupMember` model containing `joinedAt` and `leftAt` datetime fields, and added checks in the balance engine.

3. **Overloading Expenses for Settlements**:
   - *AI Output*: Suggested adding a boolean flag `isSettlement` to the `Expense` table to log peer-to-peer payments.
   - *How it was caught*: Reviewed against Aisha's request for clear, direct settlement steps. An expense has splits, split types, and multiple participants. A settlement is strictly a unidirectional transfer between two people. Combining them complicates schema constraints (e.g. making splitType nullable) and degrades query performance.
   - *What was changed*: Created a separate, lightweight `Settlement` table linked directly to the payer (`fromUserId`), payee (`toUserId`), and `group`.
