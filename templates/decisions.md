# Decisions · schema and access control

**Candidate:** ____________ **Repo:** ____________

Keep it short and specific. The panel will pick any line and ask you to explain it.

## 1 · Tables

| Table | What one row is | Key columns | Links to |
| --- | --- | --- | --- |
| | | | |

## 2 · Derived values

What do you work out instead of storing, and why? (For example: a slot's free places, an order's total.) If you store a value that could be worked out, say how it stays correct.

## 3 · Access rules

One row per table and action. "Where it lives" is the RLS policy, constraint, trigger, database function or server route that enforces it.

| Table | Action | Who may | Where it lives |
| --- | --- | --- | --- |
| | select | | |
| | insert | | |
| | update | | |
| | delete | | |

## 4 · Order states

Where is each allowed move enforced, and what stops a move that is not allowed?

## 5 · Secrets

| Key | Where it lives | Who can reach it |
| --- | --- | --- |
| Supabase anon (publishable) key | | |
| Supabase service-role (secret) key | | |
| OpenRouter key | | |
| Payment gateway key (Level 2) | | |

## 6 · What did not work

At least two honest stories: what you tried, what broke, how you found out, and what you changed.

## 7 · Levels reached

Core / Premium / Elite / Stretch. For each one, what works and what does not.
