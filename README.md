# genshin-pix-map

Community map for Genshin Impact with a high-performance WebGL renderer (pixi.js v8), built as a replacement for the official one.

**Tech stack:** TypeScript · Vite · React 19 · TanStack Query · zustand · Tailwind CSS v4 · Base UI · Biome · Jest + Playwright · bun

## Development

```bash
bun install        # install dependencies
bun run dev        # dev server (http://localhost:5173)
bun run lint       # biome check
bun run typecheck  # tsc -b
bun run test       # jest unit tests
bun run e2e        # playwright e2e (starts the dev server automatically)
```

Pushes are gated by husky hooks: pre-commit (typecheck + lint + unit tests when `src/` changes) and pre-push (e2e when outgoing commits touch `src/`).

## Performance

- 88k points (every layer enabled) rendered without frame drops; the dev-mode HUD shows live frame time
- Drag / pinch / wheel / inertia gestures on par with native map apps
- On-demand rendering: zero CPU while the map is idle

## Data & Credits

All data comes from the official Genshin Impact web map's public endpoints, no auth), self-hosted as snapshots in [genshin-map-data](https://github.com/kxxoling/genshin-map-data) and referenced as a git submodule — the app runs with zero third-party and zero CDN dependencies.

This is a community open-source tool, not affiliated with miHoYo / HoYoverse; "Genshin Impact" and all related assets are the property of their owners.

