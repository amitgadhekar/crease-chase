# Crease Chase

3D cricket batting game against an adaptive AI bowler, across eight planet venues. Single HTML file, no ads, no backend.

Play: https://amitgadhekar.github.io/crease-chase/ (redeployed by GitHub Actions on every push to `main`).

```bash
npm install && npx playwright install chromium   # only needed for the browser smoke test
npm run build      # -> dist/crease-chase.html, open it in any browser
npm test           # balance simulation + headless browser smoke test
```

To continue development with Claude Code, run `claude` in this folder. Project context and design decisions are in `CLAUDE.md`.

## Sound effects

Recorded clips in `src/sfx/` (trimmed, levelled, mono MP3), embedded into the HTML by `build.mjs`. All CC0 except where noted; no attribution is required, this is provenance.

| File | Source | Licence |
|---|---|---|
| bat.mp3 | https://freesound.org/s/162886/ | CC0 |
| edge.mp3 | https://freesound.org/s/405550/ | CC0 |
| mishit.mp3 | https://freesound.org/s/628352/ | CC0 |
| block.mp3 | https://freesound.org/s/594342/ | CC0 |
| swing.mp3 | https://freesound.org/s/474838/ | CC0 |
| gloves.mp3 | https://freesound.org/s/164499/ | CC0 |
| bounce.mp3 | https://freesound.org/s/514640/ | CC0 |
| stumps.mp3 | https://freesound.org/s/164536/ | CC0 |
| crowd.mp3 | https://freesound.org/s/829454/ | CC0 |
| cheer.mp3 | https://pixabay.com/sound-effects/people-crowd-cheer-406646/ | Pixabay Content License |
| roar.mp3 | https://freesound.org/s/829453/ | CC0 |
| groan.mp3 | https://freesound.org/s/619007/ | CC0 |
| gasp.mp3 | https://freesound.org/s/763876/ | CC0 |
| applause.mp3 | https://freesound.org/s/196098/ | CC0 |
| fw-launch.mp3 | https://freesound.org/s/186933/ | CC0 |
| fw-burst.mp3 | https://freesound.org/s/336008/ | CC0 |

Thunder is the only synthesized sound left.
