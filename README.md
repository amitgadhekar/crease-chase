# Crease Chase

3D cricket batting game against an adaptive AI bowler, across eight planet venues. Single HTML file, no ads, no backend.

```bash
npm install && npx playwright install chromium   # only needed for the browser smoke test
npm run build      # -> dist/crease-chase.html, open it in any browser
npm test           # balance simulation + headless browser smoke test
```

To continue development with Claude Code, run `claude` in this folder. Project context and design decisions are in `CLAUDE.md`.
