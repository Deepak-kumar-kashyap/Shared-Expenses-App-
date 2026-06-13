# DECISIONS.md - Decision Log

This document lists the architectural, design, and engineering decisions made while building the Shared Expenses App, outlining the alternatives considered and why we chose the selected implementations.

---

## 1. Database and ORM Selection

- **Decision**: PostgreSQL + Prisma.
- **Options Considered**:
  1. **MongoDB + Mongoose**: Excellent for flexible documents (which is tempting for unstructured CSV rows), but poor for transactional consistency, referential integrity, and complex queries like balance matrices across multiple joins.
  2. **SQLite + Prisma**: Lightweight and easy to set up, but lacking robust concurrency and production-level features.
  3. **PostgreSQL + Prisma** (Selected): Relational DB is a hard requirement. PostgreSQL provides high integrity, support for complex queries, decimal types, and is production-ready. Prisma makes migrations simple, typing consistent, and relations easy to query.

---

## 2. Modeling Dynamic Group Memberships

- **Decision**: Interval-based Membership tracking (`joinedAt` to `leftAt`) in a join table `GroupMember`.
- **Options Considered**:
  1. **Simple User-Group Relation (Many-to-Many)**: A user is either in a group or not. This is insufficient because we lose history. If Sam joined in mid-April, a simple relation would either charge him for March electricity (if added) or prevent him from splitting April common room furniture (if not added).
  2. **Snapshot-based Groups**: Creating new groups for every membership change (e.g. "Flat - Feb/Mar" and "Flat - April"). This causes fragmented history and makes overall balances and ledgers extremely hard to view across time.
  3. **GroupMember Join Table with Date Ranges** (Selected): Users are linked to groups via a membership record that has `joinedAt` (default creation) and `leftAt` (null if active). Any balance calculation matches the `expense.date` against the member's active interval:
     `joinedAt <= expense.date` AND (`leftAt == null` OR `expense.date <= leftAt`).
     This solves Sam's and Meera's requests perfectly without breaking historical context.

---

## 3. Handling Multiple Currencies (USD vs INR)

- **Decision**: Normalize everything to base currency (`INR`) at write-time, while preserving original values on the `Expense` record.
- **Options Considered**:
  1. **Single Currency DB**: Convert everything to INR before inserting, and throw away the USD details. This violates Priya's request of "no magic numbers" and transparency. Users wouldn't know that a ₹44,820 expense was actually $540 USD.
  2. **Multi-Currency Splits**: Calculate balances in separate currency buckets. This leads to users owing "Rohan ₹2,300 AND $45 USD." Aisha wants "one number per person." Multiple currency balances make settlement optimization highly convoluted.
  3. **Dual Storage (Normalized Base + Original)** (Selected): The database stores the original `amount` and `currency` (e.g. `540` and `USD`), the `exchangeRate` used (`83.0`), and the calculated `amountInInr` (`44820.00`). Splits are calculated using `amountInInr`. This satisfies Rohan (he can see the exact USD origin and exchange rate) and Aisha (one final number in INR).

---

## 4. Split Type Modeling

- **Decision**: Enumerate split types (`EQUAL`, `EXACT`, `PERCENTAGE`, `SHARE`) and represent split shares using a child table `ExpenseSplit` with raw values and computed INR allocations.
- **Options Considered**:
  1. **Store Split details as JSON**: Store the splits as a JSON block in the `Expense` row. This is fast to implement, but makes database-level aggregations (like summing total amount owed by User A in PostgreSQL) very difficult and slow.
  2. **Explicit Relations** (Selected): The `ExpenseSplit` model has foreign keys to `Expense` and `User`. This makes querying balances fast, clean, and indexes properly. It also allows us to store the exact amount owed by a person directly in the database.

---

## 5. CSV Import Anomaly Resolution Workflow

- **Decision**: Interactive Stage-and-Review UI backed by an `ImportJob` and `ImportAnomaly` database state.
- **Options Considered**:
  1. **Fail-Fast (Throw exception)**: If an error is found, stop importing. This makes importing a messy CSV impossible unless the user edits the CSV by hand, which is explicitly forbidden.
  2. **Auto-Correct (Silent guessing)**: Silently replace "Priya S" with "Priya", or "USD" with "INR" at a fixed rate, and import directly. This violates Meera's request: "Clean up the duplicates — but I want to approve anything the app deletes or changes."
  3. **Staged Database Import with Review Dashboard** (Selected): The CSV is uploaded and parsed in memory. An `ImportJob` is created in `PENDING_REVIEW` state, and all detected issues are written to `ImportAnomaly` rows. The UI shows a checklist of these anomalies. The user resolves each error/warning (e.g. mapping unknown users, selecting duplicate actions, confirming exchange rates) and clicks "Apply". The server then processes the rows and saves them as finalized `Expense` or `Settlement` records.
