# Hosting on Cloudflare: how it works and what it costs

Status: plan (owner decision 2026-10-16: Cloudflare Pages on our own domain; see docs/roadmap.md, "Launch plan", R0.7 and R2.7).

## Who runs the game?

The game runs entirely on the player's phone or computer. Cloudflare only hands over the file.

1. A player opens our domain. Cloudflare sends the game file (one HTML file, about 2 MB) from a data centre near them. That is all
   Cloudflare does.
2. From then on, the player's browser runs everything: the 3D graphics, the physics, the AI bowler, the fielders, the replays. Their
   device's CPU and GPU do the work. Saves stay in their browser (localStorage).
3. On a later visit the browser asks Cloudflare "has the file changed?" (a few hundred bytes). If not, it uses the copy it has.

So while someone plays, Cloudflare is not working at all. Serving files on Cloudflare Pages is free with no request or bandwidth
cap, so 10 players or 100,000 cost the same: $0.

## When does usage start counting?

Only once we add server code: login (R2.7), achievement sync (R2.4) and leaderboards (R3.4). Then the game sometimes calls a small
piece of our code running on Cloudflare (a Pages Function / Worker), for example "save this achievement" or "load my profile". Each
call uses:

- **1 request**: 100,000 a day are free, and each may use about 10 ms of server CPU.
- **The database rows it touches** in Cloudflare D1: 5 million rows read and 100,000 rows written a day are free, plus 5 GB of
  storage. Reads count the rows a query scans, not just the rows it returns, so every query must use an index.

Example: 1,000 players a day, each loading their profile once (about 30 rows read) and unlocking 3 achievements (3 rows written),
is about 30,000 reads and 3,000 writes a day: under 1% of the free reads and 3% of the free writes.

If a free limit is ever hit, those calls fail until midnight UTC while the game keeps playing; Cloudflare never bills us
automatically. The paid plan, if ever needed, is $5 a month.

## What it costs

| Item | Cost |
|---|---|
| Hosting the game (Cloudflare Pages) | $0, no cap on requests or bandwidth for static files |
| Database (Cloudflare D1) and server code (Workers) | $0 within the free daily quotas above; $5/month paid plan only if ever needed |
| Domain (Cloudflare Registrar, at cost) | about $10.50 a year for a .com |

## Things to remember

- **Saves are tied to the web address.** Browsers keep saves, stars and records per domain, so moving from one address to another
  starts every player from empty. We move to the final domain before announcing the game; the save backup code (R1.3) makes any
  later move recoverable.
- **Login means personal data.** With accounts (R2.7) we store at least an account identifier, so we need a short privacy policy, a
  way to delete an account on request, and the 13+ age note.
- **Deploys** come from our GitHub Actions workflow (the balance test still gates every deploy); a `_headers` file sets cache rules
  for the service worker and the manifest.

Sources: Cloudflare Pages limits https://developers.cloudflare.com/pages/platform/limits/ ; Workers pricing and limits
https://developers.cloudflare.com/workers/platform/pricing/ , https://developers.cloudflare.com/workers/platform/limits/ ; D1 pricing
and limits https://developers.cloudflare.com/d1/platform/pricing/ , https://developers.cloudflare.com/d1/platform/limits/ .
