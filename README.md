# BLINK — Retro Horror Edition

A first-person maze horror game inspired by SCP-173 and Slenderman. The monster only moves when you're not looking—don't stare too long.

## How to Play

- **WASD** — Move
- **SHIFT** — Sprint (drains stamina)
- **SPACE** — Blink (rests your eyes, refills blink meter)
- **Left click** — Toggle flashlight (off = recovers charge, on = drains)
- **Mouse** — Look around
- **Scroll** or volume keys — Master volume

**Rules:**
- Don't look away—the monster moves when you can't see it
- Don't stare at it too long—you'll die
- Collect all 5 artifacts to unlock the exit
- Manage your blink meter—it drains constantly and only refills when you blink
- Manage stamina (regen when still or walking) and flashlight charge (regen when off)

## Player mechanics (design notes)

**Weak mechanic:** Stamina only regens when you're **completely still**. So you either run (and burn stamina) or stand still (and regen while the monster can move). There's no middle option—walking is punished the same as sprinting for regen, so it often feels like "run until empty, then stand and hope." That can feel unfair instead of strategic.

**Strong mechanic to add:** Give walking a **small stamina regen** (slower than standing, but not zero). Then you have three choices: stand = fast regen but dangerous, walk = slow regen but you're still moving, sprint = no regen but escape. That makes "creep away while recovering" a real option and adds more meaningful decisions.

**Monster (implemented):** Last known position — when it sees you it remembers; when you look away it paths there (after 5s it uses current position). Sprint is loud — sprint while unseen and it paths to your current position; walk and it only uses last known.

## Features & implementation

- **HUD:** Stamina, Blink, and Light meters (bottom-left); game timer; volume bar; “LOOK AWAY!” when stare warning threshold is reached; “THE EXIT IS OPEN” when all 5 artifacts are collected.
- **Minimap:** Player at center, forward = up, 28 m radius; enemy and exit shown when in range.
- **Flashlight:** Left-click toggle. On = drains (config: `flashlightDrainRate`), off = recovers (`flashlightRecoverRate`). Light meter reflects charge.
- **Exit:** Glow and particles are hidden until all 5 artifacts are collected; then exit opens, message + chime (`playExitUnlocked()`).
- **Stare:** Configurable `stareWarningThreshold` and `stareKillTime`; observation uses dot threshold (e.g. 0.55) so periphery counts as observing.
- **Monster:** Pathfinding to last-known position (or current if sprinting “loud”); aggression scales per artifact (speed, memory decay, burst duration, teleport cooldown); base speed 2.6; heartbeat 2× when very close.
- **Artifacts:** 5 orbs; pickup refills blink (`artifactBlinkRefill`); purple gem material; optional `artifact.glb` with fallback sphere geometry.
- **Audio:** Master volume controls all sounds (walk, breathing, room tone, heartbeat, stare, jumpscare, neck snap, artifact pickup, exit chime). Volume bar and scroll/keys update live. Audio unlocks on first interaction.
- **Collision:** Sub-stepped movement (max 0.3 units per step) with wall segment sweep; threshold `WALL_HALF_SIZE + PLAYER_RADIUS + 0.12` prevents phase-through so the player doesn’t phase through walls.
- **Respawn:** Resets stare/catch timers and frame state; timer “low time” styling toggles correctly when remaining time crosses 60 s.

## Recent changes (hardening & guards)

- **Audio:** All `state.*Audio` creation guarded—only create `Audio` when asset URL exists (null otherwise). Every play/volume path uses `state.masterVolume ?? 1` and optional chaining where needed. `startRoomTone()` and `updateVolumeDisplay()` use `masterVolume ?? 1` so volume is never NaN.
- **Asset loading:** `loadGameAssets(hideLoading)` always calls `hideLoading()` when both artifact and enemy loads finish, and only if `hideLoading` is a function. Artifact load: if `gltf?.scene` is missing or load fails, fallback sphere artifacts are used. Enemy load: if `ASSETS.enemy` is missing or `gltf?.scene` is null, a fallback cylinder enemy is used. `applyEnemyTexture` and `prepareEnemy` guard against null `model`; texture load runs only when `ASSETS.enemyTexture` is set.
- **State/camera guards:** Null checks for `state.camera` in `moveEnemyStep`, `enemyIsObserved`, `checkExitDoor`, `updateFlashlightAndTimer`, and `checkArtifacts`. Respawn resets `lookingAtMonsterTime`, `enemyInCatchRangeTime`, and `state._frameCount` where used.
- **Wall phasing fix:** Sub-stepped movement with segment collision prevents tunneling at high speed; direction.normalize() guarded when stationary.

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

- **Three.js** (scene, camera, controls, GLTFLoader, pathfinding)
- **Vanilla JS** (ES modules: `game.js`, `level.js`, `enemy.js`, `audio.js`, `minimap.js`, `pathfinding.js`, `state.js`, `config.js`)
- No build step; run via a local server (required for audio)
- Asset paths and tuning in `js/config.js`; see `ASSET_SIZES.md` for asset notes
