# Asset sizes for GLBs

Use these **exact bounding-box sizes** when modeling or resizing your GLBs. Game units = **meters**. Your model’s bounding box should match these so in-game scale is correct.

---

## Artifact (purple gem)

- **Target size:** **0.8 m** on all axes (cube 0.8 × 0.8 × 0.8).
- In code we scale the loaded GLB so its bounding box fits inside 0.8 units.
- **File:** `artifact.glb` (or path set in `config.js` → `ASSETS.artifact`).

