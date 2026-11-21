# Panel access audit — 22 November 2026

Production: https://qafla-rjqd.vercel.app, shipped source 12870f381535368cb9b50059b2b835cf3c202277. Browser review: sign in, inspect landing and Account, sign out. No orders or payments. At Faisal's explicit follow-up request, five new vendor accounts were created through Supabase signup and assigned only to currently unassigned trucks; the existing T02 account was preserved. Passwords are in a local Git-ignored private handoff, not this evidence.

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

## Reviewer access

Anonymous HTTP GET, without cookies or authorization: app `/sign-in` returned **200**; repository and the commit-pinned park recording returned **404**. The owner's browser can open the repository and explicitly shows **Private**. That authenticated access does not establish access for a panel member.

Faisal must invite the panel's GitHub identities, or provide the Markdown files with their relative evidence directories as a private attachment. Do not send only a raw.githubusercontent.com video link for this private repository. Final panel-identity access is **pending** until invitations are accepted or attachments delivered. No sharing settings were changed and nothing was emailed.
