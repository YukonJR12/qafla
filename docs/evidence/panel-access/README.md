# Panel access audit — 22 November 2026

Production: https://qafla-rjqd.vercel.app. Current re-verification uses shipped source **a1881ec21f17ce718d72c715327cf4421a12d153** (PR #16). Latest browser review: nine fresh UI sign-ins in independent contexts, inspect landing and Account, then close each context. Own-profile and vendor-assignment reads independently confirm the saved role and truck. No orders or payments. At Faisal's explicit follow-up request, five new vendor accounts were created through Supabase signup and assigned only to currently unassigned trucks; the existing T02 account was preserved. Passwords are in a local Git-ignored private handoff, not this evidence.

| Panel identity | Email | Observed landing / account | Evidence |
| --- | --- | --- | --- |
| Customer A | qafla.customer.mwng8ynl@example.com | Explore; Test Customer, Customer | [Account](customer-a.png) |
| Customer B | qafla.ui.mwngu7ha@example.com | Explore; UI Test Customer, Customer | [Account](customer-b.png) |
| T02 vendor | qafla.vendor.mwng8ynl@example.com | Dune Burgers Kitchen; Truck vendor · Dune Burgers | [Kitchen](vendor-t02-kitchen.png), [Account](vendor-account.png) |
| T06 vendor | qafla.panel.t06.20261122@example.com | Lugaimat & Co kitchen; Truck vendor · Lugaimat & Co | [Kitchen](vendor-t06-kitchen.png), [Account](vendor-t06-account.png) |
| Manager | qafla.manager.mwnh12fm@example.com | Tonight across the park, all six trucks; Park manager | [Overview](manager-landing.png), [Account](manager-account.png) |
| T01 vendor (additional) | qafla.panel.t01.20261122@example.com | Karak Corner kitchen; Truck vendor · Karak Corner | [Account](vendor-t01-account.png) |
| T03 vendor (additional) | qafla.panel.t03.20261122@example.com | Taco Saha kitchen; Truck vendor · Taco Saha | [Account](vendor-t03-account.png) |
| T04 vendor (additional) | qafla.panel.t04.20261122@example.com | Noodle Wagon kitchen; Truck vendor · Noodle Wagon | [Account](vendor-t04-account.png) |
| T05 vendor (additional) | qafla.panel.t05.20261122@example.com | Saj Station kitchen; Truck vendor · Saj Station | [Account](vendor-t05-account.png) |

These are fresh UI sign-ins, not inferred roles from fixture users. Direct SQL access succeeded after loading the connection with Node's environment-file parser. Before setup, T02 was assigned and T01/T03/T04/T05/T06 were unassigned. Each new assignment checked the saved profile role was vendor and used an update guarded by `vendor_id is null`. No existing assignment was overwritten. All nine logins and six truck assignments are verified; no further account setup is required.

## Current recheck after PR #16

All nine existing accounts passed again; all six vendors still map to T01–T06. **No account or assignment is missing, so no duplicate accounts were created and no password or assignment was changed in this refresh.** [Current machine-checked inventory](current/results.json).

- Karak Corner: vendor · T01 Karak Corner; [landing](current/vendor-t01-landing.png), [Account](current/vendor-t01-account.png).
- Taco Saha: vendor · T03 Taco Saha; [landing](current/vendor-t03-landing.png), [Account](current/vendor-t03-account.png).
- Noodle Wagon: vendor · T04 Noodle Wagon; [landing](current/vendor-t04-landing.png), [Account](current/vendor-t04-account.png).
- Saj Station: vendor · T05 Saj Station; [landing](current/vendor-t05-landing.png), [Account](current/vendor-t05-account.png).
- Lugaimat & Co: vendor · T06 Lugaimat & Co; [landing](current/vendor-t06-landing.png), [Account](current/vendor-t06-account.png).
- Customer A: customer; [landing](current/customer-a-landing.png), [Account](current/customer-a-account.png).
- Customer B: customer; [landing](current/customer-b-landing.png), [Account](current/customer-b-account.png).
- Dune Burgers: vendor · T02 Dune Burgers; [landing](current/vendor-t02-landing.png), [Account](current/vendor-t02-account.png).
- Park manager: manager; [landing](current/park-manager-landing.png), [Account](current/park-manager-account.png).

The earlier creation record above is historical; the current read-only recheck confirms it is still usable. Passwords remain solely in the Git-ignored private handoff.

## Reviewer access

Anonymous HTTP GET, without cookies or authorization: app `/sign-in` returned **200**; repository and the commit-pinned park recording returned **404**. The owner's browser can open the repository and explicitly shows **Private**. That authenticated access does not establish access for a panel member.

Faisal must invite the panel's GitHub identities, or provide the Markdown files with their relative evidence directories as a private attachment. Do not send only a raw.githubusercontent.com video link for this private repository. Final panel-identity access is **pending** until invitations are accepted or attachments delivered. No sharing settings were changed and nothing was emailed.
