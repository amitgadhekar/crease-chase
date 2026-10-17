# Crease Chase: release roadmap (PRD)

Status: draft for owner review (2026-10-15), partly decided (2026-10-16, see "Owner decisions"). Nothing else is decided until the
owner marks it; decisions get dated below.

## Owner decisions

- 2026-10-16: **Replays off switch: yes** (Settings, a simple on/off, default on) -> R1.1.
- 2026-10-16: **Easy is the default for a new player's first matches: yes** (nudge to Medium after a win) -> R0.2.
- 2026-10-16: **Analytics: yes, but at the end** -> R4.1 (the provider is chosen then; recommended: cookieless).
- 2026-10-16: **Error reports: at the end** -> R4.2 (local "copy debug info" moved there from R0.5).
- 2026-10-16: **Hosting: Cloudflare Pages** (over Vercel, Netlify, Firebase and GitHub Pages; see "Launch plan") -> R0.7.
- 2026-10-16: **Buy a custom domain** and launch on it (saves are tied to the web address, so the domain comes before any
  announcement) -> R0.7.
- 2026-10-16: **One URL at launch; no web portals at the beginning** (itch.io, CrazyGames later, once the game is refined) -> R3.5.
- 2026-10-16: **Achievements with a login**, so a database is needed: **Cloudflare D1** at that time -> R2.4, R2.7.
- 2026-10-16: **Community: a Discord server** (feedback, bug reports, reviews) plus short clips on Instagram Reels / YouTube Shorts /
  TikTok and Reddit; Facebook page as a name placeholder only -> R0.8, R1.5.
- 2026-10-17: **New name: Galactic Cricket** (over Crease Chase, which is one letter from an existing web cricket game "Crease Clash" and uses a generic word; and over "Galaxy Cricket", whose .com has been taken since 2014 and which leans on Samsung's "Galaxy" mark). `galacticcricket.com` and `.game` were unregistered on 2026-10-17: the owner bought `galacticcricket.com` on 2026-10-17 (R0.7) and runs a trademark check (R0.4). The rename in the game and docs follows the current character fixes.
- 2026-10-16: **Core gameplay first**, then the release steps -> section "G" below (the owner picks its items).
- 2026-10-16: **Loading screen** on first open (done): paints at once, a progress bar through sounds, players and stadium.

**Recommended release order** (answer to "release before achievements/database?"): yes. Ship the static game first (G, then R0
and R1 on Cloudflare with no database and no login), then R2's local features, then login + D1 (R2.7). A static launch has no server
code to secure, no accounts, no privacy policy for personal data, and nothing that can go down; we learn from real players before
building a backend. Achievements can launch locally (R2.4) and sync to accounts later: on a player's first sign-in, local progress
is uploaded, so nothing is thrown away. The one thing that must be settled before launch is the domain (saves are per address).

Inputs: a code audit of the repo, launch research (hosting, portals, stores, legal, quality), player research (mobile cricket
games' reviews and retention), docs/replays.md. Sizes: S = a few hours of agent work, M = about a day, L = several days.

## 1. Goal and position

Release Crease Chase publicly as a **free, instant-play browser cricket game: no ads, no energy, no pay-to-win, no sign-up**,
installable to the home screen, short sessions, original fantasy venues, and a fair AI with published difficulty bands.
Why this position: in mobile cricket and casual games the top review complaints are monetisation and pay-to-win (34%), bugs and
crashes (22%) and intrusive ads (18%) [1]; cricket titles get the same complaints (ads, grind, energy, "impossible" finals) [2][3].
Crease Chase already avoids all of them, and at ~1.6 MB (685 KB gzipped) it loads in a moment next to 75 MB-2 GB store apps [2][3].
We don't try real-time multiplayer. Accounts and cloud-kept achievements come later on a free Cloudflare D1 database (R2.7).

Success for launch: a first-time player understands batting within 2 minutes, nothing looks broken on a mid-range phone, a shared
link previews well, and players have a reason to come back tomorrow (daily challenge, share text). Benchmarks to keep humble: mobile
games' median day-7 retention is ~4%, the top decile ~11-12% [4].

## 2. What we have

Quick match (1/2/5-over chases), T20 full match (bowl 20 overs as captain, then chase; save/resume), Scenarios (15-Test series +
10 classics, 75 stars, save/resume), Nets; 8 planet venues with real physics; slingshot batting with footwork, Loft, Hold; player
bowling (delivery chips, marker, release meter); an AI bowler that learns; athletic fielding with a drawn keeper; replays of fours,
sixes and catches; a hub menu over the live stadium; portrait and landscape; balance and smoke test suites; GitHub Pages deploy.
Done since the first draft: throws back after stops, replays v1 (bowled, LBW, stumped, drops, rope saves, near misses;
docs/replays.md), the `SMOKE_ONLY` smoke filter. In flight: production-ready characters (docs/characters.md).

## 3. Gaps, in one list

1. **Failure looks like a broken game:** no "your browser can't run this" screen (it half-starts on a dead canvas), no global
   error handler (one exception stops the loop), no WebGL context-loss recovery (iOS drops it under memory pressure), silent save
   loss in private browsing, iOS audio interruptions and the silent switch [5].
2. **No first-run teaching:** a new player gets one hint line; the stick, Loft and timing bar are untaught; How to play is a wall
   of text mixing Scenarios terms. No loading screen (blank page while the 3D builds).
3. **Not installable or shareable:** no manifest, icons, favicon, description or Open Graph cards; shared links look bare.
4. **Legal basics missing:** no LICENSE or credits/privacy page; three.js's MIT notice is likely stripped by the minifier;
   Google Fonts sends visitors' IPs to Google undisclosed; 4 Pixabay clips need their terms checked for redistribution in a public
   file; "Crease Chase" not checked for trademarks.
5. **Release safety:** the smoke test is not in CI and there are no PR checks; no version shown, no changelog, no feedback link;
   saves other than T20/Scenarios have no version or migration. **Flaky balance band (found 2026-10-16):** the T20 section of
   `tests/balance.mjs` uses unseeded randomness, and one run failed with Mercury's T20 medium win rate at 65.5% against the 35-65%
   band (logic unchanged; the rerun passed). CI runs this test before every deploy, so it can block a deploy now and then. Fix
   (owner: separately, after the character upgrade): seed the T20 simulation, or measure the spread over many seeds and size the
   band to it -> R0.5.
6. **Unmeasured on real phones:** frame rate, the bowling meter's feel, the camera cuts on dives, landscape on iPhone.
7. **Settings and accessibility are thin:** one sound toggle (no volume), red/green timing bar (colour-blind), no left-handed layout,
   reduced motion only in menus, no quality setting, no haptics.
8. **No reason to return:** no daily challenge, sharing, stats, achievements or progression; all content open on day one.
9. **iOS storage:** Safari tabs delete localStorage after 7 days without a visit; Home Screen web apps keep theirs [6]. Saves,
   stars and records are at risk unless players install or we ask for persistent storage.

## 4. Roadmap

Order (owner, 2026-10-16): **G (core gameplay) first**, then R0 -> R1 (static launch), R2, R3, R4.

### P: character polish follow-ups (owner, 2026-10-17: later)

Left open after the character upgrade and fix pass 4 (details, frames and numbers: docs/characters.md, tests/charlab/reviews/round-3.md).

| ID | Item | Size |
|---|---|---|
| P1 | Batter: late-shot bat contact 1.32 cm vs the 1 cm gate; forearms passing through each other and the handle (M2) | S-M |
| P2 | Fielder skating left: Venus dive get-up (~2 m/s) and the keeper's run into a dive; non-bowler teleport reds (the Moon/Mars/Venus split-step pop at release + 0.12 s, the generic gait at sprint speed) | M |
| P3 | Front-foot contact still reads wide from the front camera (H2); dive run-in short and get-up slips (H5) | S-M |
| P4 | Fielder chest rounded with the arms raised (H6, model or weights); keeper's head-high take puts the gloves in front of the face (M1); keeper sinks ~4 cm on dives (M5, likely the pad lip) | M |
| P5 | Elbow/knee pole flips seen only in full-lab order (M4); lab issues M7 (cordon framing ~30 m) and M8 (batter torso capsule too round) | S |
| P6 | A critic review of fix pass 4 (none was run) and a fresh round-4 check before calling the characters production ready | S |

### G: core gameplay (first; proposed items, the owner picks)

What a cricket player would still miss in the game itself (the character upgrade in docs/characters.md is already under way).

| ID | Feature | Why | Size |
|---|---|---|---|
| G1 | **Running between the wickets**: both batters run and cross for 1-3; the player calls (or turns down) runs; run-outs become real (the throws and direct hits already exist, but are show-only today) | The biggest missing piece of real cricket; makes fielding and throws matter. Adds time between balls (~2-3 s per run) | L |
| G2 | **No-balls, free hits and extras**: front-foot no-balls, high full tosses, a third bouncer; a free hit next ball (no wicket except run-out); byes, leg byes and overthrows | Real cricket rules; a free hit is a highlight moment | M |
| G3 | **Toss and batting first** in T20: win the toss, choose to bat (set a target, then defend it with the ball) or bowl (today you always bowl first) | Half of real T20 is defending a total; the AI chase mode is new work | M |
| G4 | **Bowling in Quick match** (moved up from R3.3): short formats become two innings too, reusing the T20 bowling | Bowling only exists in T20 today | M |
| G5 | **Umpire decisions and reviews**: the umpire's signal for outs and boundaries; one player review per innings for LBW and caught-behind, using the LBW replay's ball path | Drama and fairness; the replay already draws the path | M |
| G6 | **Shot range and left-handers**: sweeps and reverse sweeps outside Tests, a ramp/scoop and an upper cut, and a left-handed batter option (mirrored stance, field and lines) | More ways to score; left-handers are a basic expectation | M-L |
| G7 | **Captaincy choices**: set the batting order, promote a pinch hitter, a nightwatchman; move single fielders when bowling (today: field plans only) | Strategy depth for T20 and Scenarios | M |

Recommended order: G1 (it changes how every ball ends, so the rest builds on it), G2, G3, G4, then G5-G7 as wanted.

### R0: before we tell anyone (launch blockers)

| ID | Feature | Why | Size |
|---|---|---|---|
| R0.1 | **Robustness:** capability check screen (WebGL2, audio), global error handler + survive a bad frame + "tap to reload" (save kept), WebGL context lost/restored rebuild, private-mode "progress won't be saved" notice, AudioContext resume on gesture and after interruptions, one-time iOS silent-switch tip | Gap 1; crashes are the #2 complaint [1] | M |
| R0.2 | **First run:** loading screen (done 2026-10-16); a 3-step hands-on tutorial in Nets (drag and release on the bar, Loft, footwork) offered on first launch and from a "Learn to bat" entry; difficulty blurbs, Easy as the default for a new player's first matches with a nudge to Medium after a win (owner, 2026-10-16); How to play split into Basics / Bowling / Scenarios / Keyboard | Gap 2; teach one mechanic at a time, learn by doing, quick early win [7][8] | M |
| R0.3 | **Install and share:** icon set (original ball-and-stumps art), favicon, manifest, apple-touch-icon, meta description, Open Graph/Twitter cards with an image, canonical URL; Pages workflow ships these files; `navigator.storage.persist()`; an "Add to Home Screen" hint on iOS | Gaps 3 and 9; installability needs a manifest and icons [9] | S-M |
| R0.4 | **Legal:** LICENSE (owner's choice, Q4), About/Credits page (licences, sound sources, one-line privacy statement), three.js notice kept in the build, fonts self-hosted, the 4 Pixabay clips replaced with CC0 or confirmed, name check | Gap 4 | S |
| R0.5 | **Release engineering:** smoke in CI plus PR checks, a `SMOKE_ONLY` filter for fast iteration (done), build version + commit in Settings, CHANGELOG and tags, a "Send feedback" link, a bundle-size budget, versioned saves with a `migrate()` per key, a deterministic (seeded) T20 balance check so CI never fails at random (gap 5) | Gap 5; makes every later track faster and safer | S-M |
| R0.6 | **Real-device pass (owner + agent):** an older iPhone, a recent iPhone, a mid-range Android: frame rate and quality tier, meter feel, dive camera cuts, landscape, install, offline; fixes from it | Gap 6; the biggest unknown | M |
| R0.7 | **Move to Cloudflare Pages on our own domain** (owner, 2026-10-16): Cloudflare account, Pages project `crease-chase`, the GitHub Actions workflow deploys there (balance gate kept), `_headers` for the service worker and manifest, domain bought at Cloudflare Registrar and attached; the GitHub Pages copy then links to the new URL | One permanent URL before anyone saves progress (see "Launch plan") | S |
| R0.8 | **Discord server** (owner, 2026-10-16): channels and moderation as in "Launch plan", a permanent invite as "Community (13+)" in the menu and credits, the game version shown in Settings/pause so bug reports can include it | Feedback, bug reports and reviews in one place | S |
| R0.9 | **Protect the game from copies** (owner, 2026-10-16; see "Copy protection" below): make the GitHub repository private once deploys go to Cloudflare (today the full source, Blender scripts and docs are public); "All rights reserved" LICENSE and a copyright line in the game's About/credits and the built file's header; a domain lock (the game only starts on our domain and localhost, with a "play the original at <our domain>" message elsewhere); `frame-ancestors`/`X-Frame-Options` headers in `_headers` so other sites can't embed it; keep the minified game bundle and also minify what is still readable in the page: the inlined `src/logic.js` (physics, AI bowler, fielding, captain logic, scenarios; today pasted with its comments) and the CSS, through esbuild in `build.mjs` (the balance test keeps loading the readable `src/logic.js`; top-level names the game bundle calls stay); a short takedown playbook (DMCA notices to GitHub, Cloudflare, portals and app stores) | A web game's code always reaches the player's browser; these steps raise the effort to copy it and give us the legal tools to remove copies | S |

### R1: launch polish (soft launch on our own URL)

| ID | Feature | Why | Size |
|---|---|---|---|
| R1.1 | **Settings:** volume (master, crowd/effects), quality (Auto/High/Low) and a 30/60 fps cap, colour-blind-safe timing bar, reduced motion that also covers camera moves and shortens replays, a **Replays on/off switch (default on; owner, 2026-10-16)**, haptics on Android, mirrored controls (stick right, Loft left) | Gap 7; accessibility guidelines [10] | M |
| R1.2 | **Offline and updates:** service worker (offline cold start), "new version, tap to update" prompt | Offline play is a stated differentiator [2]; stale pages after updates | M |
| R1.3 | **Save backup:** export/import a save code (stars, records, settings, a T20 in progress) | Gap 9; "an update wiped my progress" is a classic complaint [2] | S |
| R1.4 | **Replays v1** (done, docs/replays.md) | Owner request | M |
| R1.5 | **Soft launch and promotion:** our URL only (no portals yet); one 10-20 s clip (a six, a diving catch) cut once and posted to Instagram Reels, YouTube Shorts and TikTok; a Reddit post (r/IndieGaming or r/playmygame, following each sub's self-promotion rules); README with screenshots and the play link | Short clips give the best reach for the effort; Facebook organic reach is ~1.8% [26] | S |

### R2: reasons to come back (R2.4/R2.7 need the D1 backend; the rest has no backend)

| ID | Feature | Why | Size |
|---|---|---|---|
| R2.1 | **Share result:** end screen "Share" (system share sheet, copy fallback) with a spoiler-free text line, plus an optional image card | Wordle-style sharing spread by messaging apps [12]; the only no-backend "multiplayer" | S-M |
| R2.2 | **Daily Challenge:** one date-seeded situation per day, the same for everyone (a chase or a scenario), stars, a streak, its own share line; works offline | The strongest retention idea for a client-only game [2][12]; needs the game's random draws seeded per delivery | M-L |
| R2.3 | **Stats and profile:** lifetime runs, sixes, strike rate, best scores per mode/planet, a wagon wheel, timing accuracy | Cricket fans expect stats and wagon wheels [3] | M |
| R2.4 | **Achievements:** ~25 (3 sixes in an over, 20+ in the last over, a hat-trick while bowling, all planets won, a Test series...), earned and shown locally, kept per player in D1 after login (owner, 2026-10-16) | Goals without a currency; backlog item 3 | M |
| R2.5 | **Commentary text:** short state-aware lines with anti-repeat memory (no voice) | Repetitive commentary is a top complaint in the big games [13]; text is cheap | M |
| R2.6 | **Arcade assist** for new players: wider windows, auto footwork, aim helper, alongside today's controls | Tiered controls are praised [14]; complements R0.2 | M |
| R2.7 | **Accounts, login and cloud progress** (owner, 2026-10-16): optional sign-in, achievements/records/stars synced to Cloudflare D1 through Pages Functions; playing without an account keeps working. To decide when it starts: the sign-in method (e.g. "Sign in with Google" or an email magic link handled in a Worker, or a hosted auth service), and Turnstile against spam sign-ups. Adds a privacy policy (what is stored, deletion on request), the 13+ age note, and the end of "nothing leaves your device" | Achievements that follow the player across devices; also fixes iOS's 7-day storage eviction for signed-in players | L |

### R3: depth and growth (after launch data)

| ID | Feature | Why | Size |
|---|---|---|---|
| R3.1 | **Career across the planets:** a season ladder of AI teams, a trophy per planet, unlocks that are cosmetic or skill-based, never bought | The structural hook every competitor has [3]; backlog 2 | L |
| R3.2 | **Team, kit and name editor** (with export) | Customisation is expected, losing it is hated [3] | M |
| R3.3 | (moved to G4) | | |
| R3.4 | **Leaderboard** for the daily challenge (Cloudflare Worker + D1 free tier, plausibility caps; cheating accepted) | Social pull, only after the daily has players [15] | L |
| R3.5 | **Web portals, later** (owner, 2026-10-16: not at the beginning): itch.io, then CrazyGames Basic Launch (no SDK needed; read the developer agreement first), once the game is refined | Bigger audience test [11][16] | S |
| R3.6 | **Performance:** merge each person's meshes (halves draw calls) if R0.6 shows slow phones | Low-end phones overheating is a top complaint [1] | L |

### R4: at the end (owner, 2026-10-16)

| ID | Feature | Why | Size |
|---|---|---|---|
| R4.1 | **Analytics:** privacy-friendly, cookieless (recommended: Cloudflare Web Analytics, free, no banner) [21]; a privacy line in About; events limited to page views, mode starts and first-run completion | See first-run drop-off and which modes are played | S |
| R4.2 | **Error reports:** "copy debug info" (version, browser, quality tier, GL info, last error) next to the feedback link; optionally a hosted service with IP collection off [22] | Know what breaks on real devices | S |

## 5. Not doing (and why)

- Real-time multiplayer: needs game servers; not our position. (Accounts and cloud-kept achievements are planned: R2.7.)
- Web portals at launch (owner, 2026-10-16): one URL first; portals later (R3.5).
- Paid hosting: Cloudflare's free plan covers a static game, and its free D1/Workers quotas cover the planned backend.
- Ads, energy, currencies, pay-to-win: the top complaints we exist to avoid [1].
- Poki's web-exclusive deal: it would remove the open-web copy (5-year default term) [17].
- App Store / Google Play at launch: $99/yr and Apple's "repackaged website" rule (4.2) risk; Play needs 12 testers for 14 days on
  new personal accounts [18][19]. Revisit if web installs stall.
- Real names, events, kits or trademarks ("The Ashes" is a registered mark in Australia) [20].
- Super Over mode: removed earlier by owner decision.

## 6. Parallel tracks (how we run it)

Tracks are split by the files they touch, so up to three can run at once in separate worktrees (smoke runs are CPU-heavy: two at
a time is the practical limit on this Mac; R0.5's `SMOKE_ONLY` filter goes first because it speeds up every other track).

| Track | Items | Main files | Conflicts with |
|---|---|---|---|
| A. Platform and legal | R0.3, R0.4, R0.5, R0.9, R1.2, R1.5 | index.html head, build.mjs, pages.yml, new icon/manifest/sw files, README, LICENSE | little (index.html head only) |
| B. Robustness and settings | R0.1, R1.1, R1.3 | 01-core, 02-audio, 07-render3d (context loss), 09-menu-boot, styles | C (menu sheets) |
| C. First run and assist | R0.2, R2.6 | 05-input, 04-match-flow (hints), index.html sheets, styles | B (menu) |
| D. Replays | R1.4 | 08b-replay, 04-match-flow, logic.js (`highlightOf`) | C (04-match-flow, small) |
| E. Retention | R2.1-R2.5 | new 04e module, 03-hud, end screen, records | B (store versioning first) |
| F. Hosting and backend | R0.7, R2.7 (and R3.4) | pages.yml, `_headers`, `functions/` (Pages Functions), `wrangler.toml`, D1 schema | little (E for achievement sync) |

Core gameplay (section G) comes first (owner); its items mostly touch logic.js, 04-match-flow and the people/bowling code, so they
run one at a time after the character upgrade lands, alongside track A (platform/legal), which touches none of those files.
Then the release waves: **Wave 1:** A + D (+ C if B waits). **Wave 2:** B + C, then the owner's real-device pass (R0.6), the
move to Cloudflare on our domain (R0.7) and the Discord server (R0.8) -> soft launch (R1.5). **Wave 3:** E (share and daily first), then announce. **Later:** R3 by what launch data and players ask for. **At the end:** R4 (analytics, error reports).

## 7. Launch plan: hosting, data, community (owner decisions 2026-10-16; research by a Sonnet agent the same day)

**Hosting: Cloudflare Pages, free, on our own domain.**
- Static files are served free with no request or bandwidth cap [23]; nothing is billed on the free plan (over a free limit, requests
  fail instead). Custom domains, unlimited preview deployments, `_headers` for cache rules (needed for the service worker), deploys
  from our GitHub Actions workflow with `cloudflare/wrangler-action` (the balance-test gate stays) [23][24].
- Rejected: Vercel Hobby (non-commercial use only; over the limit the deployment pauses for up to 30 days) [25]; Netlify Free
  (300 credits/month, 15 per production deploy: ~20 deploys) and Firebase Spark (~10 GB/month, ~5k game loads) run out fast;
  GitHub Pages works but can't set response headers.
- Domain: bought at Cloudflare Registrar at cost (~$10.50/yr for a .com, free WHOIS privacy). **Buy and switch before announcing:**
  browsers keep saves, stars and records per web address, so every address change starts players from empty (R1.3's save code
  makes later moves recoverable).

**How the free capacity is used (who pays for what).** The plain-language version is in docs/hosting.md.
- The game is one static file. Cloudflare stores it in its data centres and sends it to each player's browser once (~2 MB; later
  visits revalidate in a few hundred bytes). After that, **everything runs on the player's phone or computer**: the 3D rendering, the
  physics, the AI bowler, the fielding, the replays. Cloudflare does no work while someone plays; saves stay in the browser.
- So today the only "usage" is file downloads, and those are free and uncapped on Pages.
- Costs only exist once we add server code (R2.7 login, R2.4 achievement sync, R3.4 leaderboard). Then each call from the game to our
  backend (e.g. "save this achievement", "load my profile") counts as one Worker/Function request (free: 100k a day; ~10 ms CPU each)
  plus the D1 rows it reads or writes (free: 5M rows read and 100k rows written a day, 5 GB stored) [27][28]. Rows are counted as
  scanned, so queries must use indexes (a query that scans a whole table counts every row).
- Example: 1,000 players a day, each loading a profile once (~30 rows read) and unlocking 3 achievements (3 writes): ~30k reads and
  ~3k writes, under 1% of the free reads and 3% of the free writes. If a free limit is ever hit, calls fail until 00:00 UTC (the game
  keeps working offline); there is no surprise bill. The paid plan, if ever needed, is $5/month [29].

**Database: none until login and achievements are built; then Cloudflare D1** in the same account (no inactivity pausing, unlike
Supabase's free tier, which pauses after 7 days of low activity [30]). Pages Functions bind to D1 directly [28]. D1 has no built-in
sign-in, so R2.7 picks a sign-in method; Turnstile (free) protects sign-up and score endpoints [31]. Leaderboards accept that client
scores can be forged: sanity bounds, rate limits, and server-side re-simulation of daily-challenge scores later.

**Community.**
- Discord (free, 13+ [32]): `#rules-and-info` (read-only), `#announcements` (patch notes), `#general`, `#feedback` (forum channel),
  `#bug-reports` (forum channel with a template asking for device, browser and game version, and required tags Open / Confirmed /
  Fixed / Won't fix [33]), `#screenshots-and-clips`, private `#dev-chat` and `#admin-log`. Moderation: email verification, AutoMod
  (spam, mention spam, scam links) reporting to `#admin-log`, 2FA, Community mode with rules screening [34]. A permanent invite in
  the game ("Community (13+)"). A short triage pass a few times a week.
- Promotion: one 10-20 s clip cut once and posted to Instagram Reels, YouTube Shorts and TikTok; Reddit posts within each
  subreddit's rules; a Facebook page only to hold the name (organic reach ~1.8% [26]). Original art only in clips and thumbnails.

**Steps (R0.7, R0.8):** Cloudflare account -> Pages project `crease-chase` (Direct Upload) -> repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the owner creates these) -> workflow deploys with wrangler -> `_headers` ->
buy the domain and attach it -> the GitHub Pages copy links to the new URL -> Discord server and the in-game link. Cost: $0 plus the
domain.

**Copy protection (R0.9; owner question 2026-10-16: "someone could copy the HTML and release the game as their own").**
- What can't be prevented: every web game sends its code to the player's browser, so a determined person can save the file and
  read it. No setting or tool stops that (there is no DRM for web pages); the realistic goal is to make copying more work than it
  is worth, to make copies worse than the original, and to be able to take copies down.
- The biggest exposure today is not the HTML: the GitHub repository is public, so the readable source, the Blender model scripts
  and every design doc are one click away. GitHub Pages on a free account needs a public repository; Cloudflare deploys from a
  private one through our Actions workflow, so the repository goes private after the move (R0.7). Copies made from the public
  history so far can't be recalled.
- Legal: copyright exists automatically; an "All rights reserved" LICENSE plus a copyright line in the game and the file header
  make it explicit and support DMCA takedown notices, which GitHub, Cloudflare, portals and app stores act on. Original names and
  art (already a rule) and, if the game takes off, registering the name as a trademark make the brand ours.
- Technical deterrents: the game bundle (src/game + three.js) is already minified by esbuild (one long line, short variable
  names, unused three.js removed), but `src/logic.js` (the core rules and AI) and the CSS are pasted into the page readable, with
  comments; minifying the page's copies in `build.mjs` closes that gap at no cost (the balance test still uses the source file); a domain lock and anti-embedding
  headers stop the lazy forms of copying (re-hosting the file as is, or showing our game inside someone else's site with their ads).
  Accounts, cloud-kept achievements and leaderboards (R2.4, R2.7, R3.4) only work against our backend, so copies lose them.
- Rejected: heavy obfuscation (e.g. javascript-obfuscator): it slows the game and grows the file noticeably, can break the build's
  optimisations, and is undone by deobfuscation tools, so it mostly costs our players.

## 8. Questions for the owner (recommended answer first)

Answered 2026-10-16 (see "Owner decisions"): analytics (at the end, R4.1), error reports (at the end, R4.2), replays off switch
(yes, R1.1), Easy as the default (yes, R0.2), URL (Cloudflare Pages + a custom domain, R0.7), launch places (our URL only; portals
later), community (Discord + clips). Still open:

1. ~~Domain name~~ answered 2026-10-17: Galactic Cricket, `galacticcricket.com` (owner buys it; trademark check first, R0.4).
2. **Analytics provider** (when R4.1 starts): cookieless Cloudflare Web Analytics (recommended) or GoatCounter [21]?
3. **Error reports** (when R4.2 starts): local only (recommended), or also a hosted service with IP collection off [22]?
4. **Licence and repository visibility:** all rights reserved (default with no licence file; others can read but not reuse), MIT,
   or source-available? Recommended: all rights reserved with third-party notices, and the repository made private after the move
   to Cloudflare (R0.9).
5. **Sign-in method** for R2.7 (when it starts): Google sign-in, an email magic link, or a hosted auth service.

## Sources

[1] https://unstar.app/blog/gaming-app-reviews-what-mobile-gamers-hate-most-2026
[2] https://apps.apple.com/app/id1025281689 (WCC2 store page and reviews); https://www.lilachbullock.com/free-offline-cricket-games-android-pc-no-wifi/
[3] https://apps.apple.com/us/app/-/id638334589 (Stick Cricket Premier League); https://www.cricketweb.net/?p=24245 (Cricket 24 review)
[4] https://investgame.net/wp-content/uploads/2026/01/2026-01-27-2026-mobile-pc-benchmarks_compressed.pdf (GameAnalytics 2026 benchmarks)
[5] https://docs.crazygames.com/requirements/technical/ (iOS AudioContext interruptions)
[6] https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ ; https://webkit.org/blog/14403/updates-to-storage-policy/
[7] https://developer.apple.com/app-store/onboarding-for-games/
[8] https://gameaccessibilityguidelines.com/intermediate/
[9] https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable ; https://firt.dev/notes/pwa-ios/
[10] https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/108
[11] https://itch.io/docs/creators/html5
[12] https://techcrunch.com/2022/05/04/wordle-new-york-times-user-growth
[13] https://board.bigant.com/t/cricket-24-a-day-one-dive-into-bigants-latest-offering-xbox-series-x-v0-2-1339/655
[14] https://wisden.com/cricket-features/cricket-26-review-big-ant-studios
[15] https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/workers/platform/limits/
[16] https://docs.crazygames.com/requirements/intro/
[17] https://developers.poki.com/guide/revenue-deal-types
[18] https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/programs/
[19] https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB
[20] https://dcc.com/wp-content/uploads/2026/02/DCC_Sports-IP_Cricket.pdf
[21] https://www.cloudflare.com/web-analytics/ ; https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications
[22] https://docs.sentry.io/platforms/javascript/data-management/data-collected/
[23] https://developers.cloudflare.com/pages/platform/limits/ ; https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/workers/static-assets/headers/
[24] https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/ ; https://developers.cloudflare.com/pages/configuration/preview-deployments/
[25] https://vercel.com/docs/limits/fair-use-guidelines ; https://vercel.com/docs/plans/hobby ; https://vercel.com/kb/guide/why-is-my-account-deployment-blocked
[26] https://www.socialinsider.io/blog/social-media-reach/ (third-party benchmark)
[27] https://developers.cloudflare.com/workers/platform/limits/
[28] https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/pages/functions/bindings/
[29] https://developers.cloudflare.com/workers/platform/pricing/#workers
[30] https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/free-project-pausing
[31] https://developers.cloudflare.com/turnstile/plans/
[32] https://discord.com/terms
[33] https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ
[34] https://docs.discord.com/developers/game-development/how-to-create-a-community-for-your-game ; https://support.discord.com/hc/en-us/articles/1500000466882
