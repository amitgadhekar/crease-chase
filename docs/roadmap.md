# Crease Chase: release roadmap (PRD)

Status: draft for owner review (2026-10-15). Nothing here is decided until the owner marks it; decisions get dated below.
Inputs: a code audit of the repo, launch research (hosting, portals, stores, legal, quality), player research (mobile cricket
games' reviews and retention), docs/replays.md. Sizes: S = a few hours of agent work, M = about a day, L = several days.

## 1. Goal and position

Release Crease Chase publicly as a **free, instant-play browser cricket game: no ads, no energy, no pay-to-win, no sign-up**,
installable to the home screen, short sessions, original fantasy venues, and a fair AI with published difficulty bands.
Why this position: in mobile cricket and casual games the top review complaints are monetisation and pay-to-win (34%), bugs and
crashes (22%) and intrusive ads (18%) [1]; cricket titles get the same complaints (ads, grind, energy, "impossible" finals) [2][3].
Crease Chase already avoids all of them, and at ~1.6 MB (685 KB gzipped) it loads in a moment next to 75 MB-2 GB store apps [2][3].
What we can't match without a backend: real-time multiplayer and cloud progress. We don't try.

Success for launch: a first-time player understands batting within 2 minutes, nothing looks broken on a mid-range phone, a shared
link previews well, and players have a reason to come back tomorrow (daily challenge, share text). Benchmarks to keep humble: mobile
games' median day-7 retention is ~4%, the top decile ~11-12% [4].

## 2. What we have

Quick match (1/2/5-over chases), T20 full match (bowl 20 overs as captain, then chase; save/resume), Scenarios (15-Test series +
10 classics, 75 stars, save/resume), Nets; 8 planet venues with real physics; slingshot batting with footwork, Loft, Hold; player
bowling (delivery chips, marker, release meter); an AI bowler that learns; athletic fielding with a drawn keeper; replays of fours,
sixes and catches; a hub menu over the live stadium; portrait and landscape; balance and smoke test suites; GitHub Pages deploy.
In flight: throws back after stops (finishing), replays v1 (bowled, LBW, stumped, drops, rope saves, near misses; docs/replays.md).

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
   saves other than T20/Scenarios have no version or migration.
6. **Unmeasured on real phones:** frame rate, the bowling meter's feel, the camera cuts on dives, landscape on iPhone.
7. **Settings and accessibility are thin:** one sound toggle (no volume), red/green timing bar (colour-blind), no left-handed layout,
   reduced motion only in menus, no quality setting, no haptics.
8. **No reason to return:** no daily challenge, sharing, stats, achievements or progression; all content open on day one.
9. **iOS storage:** Safari tabs delete localStorage after 7 days without a visit; Home Screen web apps keep theirs [6]. Saves,
   stars and records are at risk unless players install or we ask for persistent storage.

## 4. Roadmap

### R0: before we tell anyone (launch blockers)

| ID | Feature | Why | Size |
|---|---|---|---|
| R0.1 | **Robustness:** capability check screen (WebGL2, audio), global error handler + survive a bad frame + "tap to reload" (save kept), WebGL context lost/restored rebuild, private-mode "progress won't be saved" notice, AudioContext resume on gesture and after interruptions, one-time iOS silent-switch tip | Gap 1; crashes are the #2 complaint [1] | M |
| R0.2 | **First run:** loading splash; a 3-step hands-on tutorial in Nets (drag and release on the bar, Loft, footwork) offered on first launch and from a "Learn to bat" entry; difficulty blurbs, Easy suggested for the first matches; How to play split into Basics / Bowling / Scenarios / Keyboard | Gap 2; teach one mechanic at a time, learn by doing, quick early win [7][8] | M |
| R0.3 | **Install and share:** icon set (original ball-and-stumps art), favicon, manifest, apple-touch-icon, meta description, Open Graph/Twitter cards with an image, canonical URL; Pages workflow ships these files; `navigator.storage.persist()`; an "Add to Home Screen" hint on iOS | Gaps 3 and 9; installability needs a manifest and icons [9] | S-M |
| R0.4 | **Legal:** LICENSE (owner's choice, Q4), About/Credits page (licences, sound sources, one-line privacy statement), three.js notice kept in the build, fonts self-hosted, the 4 Pixabay clips replaced with CC0 or confirmed, name check | Gap 4 | S |
| R0.5 | **Release engineering:** smoke in CI plus PR checks, a `SMOKE_ONLY` filter for fast iteration, build version + commit in Settings, CHANGELOG and tags, "Send feedback" link + "copy debug info", a bundle-size budget, versioned saves with a `migrate()` per key | Gap 5; makes every later track faster and safer | S-M |
| R0.6 | **Real-device pass (owner + agent):** an older iPhone, a recent iPhone, a mid-range Android: frame rate and quality tier, meter feel, dive camera cuts, landscape, install, offline; fixes from it | Gap 6; the biggest unknown | M |

### R1: launch polish (soft launch on our URL + itch.io)

| ID | Feature | Why | Size |
|---|---|---|---|
| R1.1 | **Settings:** volume (master, crowd/effects), quality (Auto/High/Low) and a 30/60 fps cap, colour-blind-safe timing bar, reduced motion that also covers camera moves and shortens replays, haptics on Android, mirrored controls (stick right, Loft left) | Gap 7; accessibility guidelines [10] | M |
| R1.2 | **Offline and updates:** service worker (offline cold start), "new version, tap to update" prompt | Offline play is a stated differentiator [2]; stale pages after updates | M |
| R1.3 | **Save backup:** export/import a save code (stars, records, settings, a T20 in progress) | Gap 9; "an update wiped my progress" is a classic complaint [2] | S |
| R1.4 | **Replays v1** (planned, docs/replays.md) | Owner request | M |
| R1.5 | **Distribution:** itch.io page (single HTML upload, no SDK, free) with a short clip of a six and a catch; README with screenshots and the play link | Cheapest real audience [11] | S |

### R2: reasons to come back (no backend)

| ID | Feature | Why | Size |
|---|---|---|---|
| R2.1 | **Share result:** end screen "Share" (system share sheet, copy fallback) with a spoiler-free text line, plus an optional image card | Wordle-style sharing spread by messaging apps [12]; the only no-backend "multiplayer" | S-M |
| R2.2 | **Daily Challenge:** one date-seeded situation per day, the same for everyone (a chase or a scenario), stars, a streak, its own share line; works offline | The strongest retention idea for a client-only game [2][12]; needs the game's random draws seeded per delivery | M-L |
| R2.3 | **Stats and profile:** lifetime runs, sixes, strike rate, best scores per mode/planet, a wagon wheel, timing accuracy | Cricket fans expect stats and wagon wheels [3] | M |
| R2.4 | **Achievements:** ~25 local ones (3 sixes in an over, 20+ in the last over, a hat-trick while bowling, all planets won, a Test series...) | Goals without a currency; backlog item 3 | M |
| R2.5 | **Commentary text:** short state-aware lines with anti-repeat memory (no voice) | Repetitive commentary is a top complaint in the big games [13]; text is cheap | M |
| R2.6 | **Arcade assist** for new players: wider windows, auto footwork, aim helper, alongside today's controls | Tiered controls are praised [14]; complements R0.2 | M |

### R3: depth and growth (after launch data)

| ID | Feature | Why | Size |
|---|---|---|---|
| R3.1 | **Career across the planets:** a season ladder of AI teams, a trophy per planet, unlocks that are cosmetic or skill-based, never bought | The structural hook every competitor has [3]; backlog 2 | L |
| R3.2 | **Team, kit and name editor** (with export) | Customisation is expected, losing it is hated [3] | M |
| R3.3 | **Bowling in Quick match** (reuse T20 bowling) | Backlog 1 | M |
| R3.4 | **Leaderboard** for the daily challenge (Cloudflare Worker + D1 free tier, plausibility caps; cheating accepted) | Social pull, only after the daily has players [15] | L |
| R3.5 | **CrazyGames Basic Launch** (no SDK needed; read the developer agreement first) | Bigger audience test [16] | S |
| R3.6 | **Performance:** merge each person's meshes (halves draw calls) if R0.6 shows slow phones | Low-end phones overheating is a top complaint [1] | L |

## 5. Not doing (and why)

- Real-time multiplayer, accounts, cloud saves: need a backend; not our position.
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
| A. Platform and legal | R0.3, R0.4, R0.5, R1.2, R1.5 | index.html head, build.mjs, pages.yml, new icon/manifest/sw files, README, LICENSE | little (index.html head only) |
| B. Robustness and settings | R0.1, R1.1, R1.3 | 01-core, 02-audio, 07-render3d (context loss), 09-menu-boot, styles | C (menu sheets) |
| C. First run and assist | R0.2, R2.6 | 05-input, 04-match-flow (hints), index.html sheets, styles | B (menu) |
| D. Replays | R1.4 | 08b-replay, 04-match-flow, logic.js (`highlightOf`) | C (04-match-flow, small) |
| E. Retention | R2.1-R2.5 | new 04e module, 03-hud, end screen, records | B (store versioning first) |

Proposed waves: **Wave 1 (now):** A + D (+ C if B waits). **Wave 2:** B + C, then the owner's real-device pass (R0.6) -> soft
launch (R1.5). **Wave 3:** E (share and daily first), then announce. **Later:** R3 by what launch data and players ask for.

## 7. Questions for the owner (recommended answer first)

1. **URL:** a custom domain before announcing (registration fee only; stable links and nicer cards), or stay on github.io?
2. **Analytics:** none (simplest privacy story), or cookieless Cloudflare Web Analytics (free, no banner; adds a privacy line) [21]?
   Recommended: cookieless, so we can see first-run drop-off and which modes are played.
3. **Error reports:** local only ("copy debug info" + feedback link), or a hosted service with IP collection off [22]?
   Recommended: local only at launch.
4. **Licence for the repo:** all rights reserved (default with no licence file; others can read but not reuse), MIT, or
   source-available? Recommended: decide consciously before launch; it's a product, so all rights reserved with third-party notices.
5. **Replays off switch** in Settings (you chose to keep every boundary replay; some players skip them all)? Recommended: yes, a
   simple on/off, default on.
6. **Easy as the default** for a new player's first matches? Recommended: yes, with a nudge to Medium after a win.
7. **Launch places:** our URL + itch.io at soft launch, CrazyGames Basic Launch after; Reddit/cricket communities only after
   reading each one's self-promotion rules. OK?

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
