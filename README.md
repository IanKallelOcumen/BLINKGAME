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

## Player mechanics (design notes)

**Weak mechanic:** Stamina only regens when you're **completely still**. So you either run (and burn stamina) or stand still (and regen while the monster can move). There's no middle option—walking is punished the same as sprinting for regen, so it often feels like "run until empty, then stand and hope." That can feel unfair instead of strategic.

**Strong mechanic to add:** Give walking a **small stamina regen** (slower than standing, but not zero). Then you have three choices: stand = fast regen but dangerous, walk = slow regen but you're still moving, sprint = no regen but escape. That makes "creep away while recovering" a real option and adds more meaningful decisions.

**Monster (implemented):** Last known position — when it sees you it remembers; when you look away it paths there (after 5s it uses current position). Sprint is loud — sprint while unseen and it paths to your current position; walk and it only uses last known.

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

## Challenges & engagement

**Consider removing or softening**
- Timer pressure that only punishes (e.g. make it optional or only affect a "speed run" mode).
- Redundant UI text so the screen stays readable.
- Overly harsh "instant death" edge cases; prefer clear feedback (e.g. stare warning, then death).

**Consider adding**
- **Challenge modes** (e.g. Speed Run: beat the clock; No Blink: no SPACE refill; Never Look: win without ever looking at the monster).
- **Difficulty options**: shorter/longer stare time, more/fewer lives, enemy speed.
- **Replay hooks**: best time, fewest blinks, or "escape in under X minutes" badge.
- **One optional "hardcore" run**: one life, no minimap, no timer—pure survival.

## Tech

- Three.js
- Vanilla JS (ES modules)
- No build step
