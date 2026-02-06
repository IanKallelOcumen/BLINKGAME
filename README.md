# BLINK — Retro Horror Edition

A first-person maze horror game inspired by SCP-173 and Slenderman. The monster only moves when you're not looking—don't stare too long.

## How to Play

- **WASD** — Move
- **SHIFT** — Sprint (drains stamina)
- **SPACE** — Blink (rests your eyes, refills blink meter)
- **Mouse** — Look around

**Rules:**
- Don't look away—the monster moves when you can't see it
- Don't stare at it too long—you'll die
- Collect all 5 artifacts to unlock the exit
- Manage your blink meter—it drains constantly and only refills when you blink

## Run Locally

You need a local server (browsers block audio from `file://`):

```bash
npm run serve
```

Then open http://localhost:3000 and click to start.

Or use any static server:
```bash
npx serve . -p 3000
```

## Tech

- Three.js
- Vanilla JS (ES modules)
- No build step
