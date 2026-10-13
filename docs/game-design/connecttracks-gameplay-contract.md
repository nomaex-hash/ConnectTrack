# ConnectTracks — Gameplay Contract

Status: CONFIRMED by the project owner. This document is the authority for ConnectTracks gameplay behavior. Where a behavior is not listed as confirmed, it is **UNKNOWN** and must not be implemented as if it were confirmed.

Reference game: Connect Tracks: Logic Puzzle (Oakever Games).

---

## 1. Core concepts

### 1.1 Level Solution Truth

- The level's solution is immutable data loaded from the level file (`s`, `a`, `b`, plus the grid size).
- Whether a cell is a solution Track is decided **only** by this immutable data, never by the player's current state.
- Level Solution Truth is separate from Player State. Player actions never change it.

### 1.2 Main Track

- The Main Track exists from level start.
- It is fixed and immutable. It is not part of the player's mutable state.
- It has exactly two connection directions (its two ports).
- A Player Track connected to a Main Track cell counts that connection toward its degree (see §4.2).
- Main Track derivation (CONFIRMED mapping of level fields):
  - The Main Track's two ports are:
    1. the outward direction `a` (at `s[0]`) and/or `b` (at `s[-1]`), as given by the level data, and
    2. the direction toward `s[1]` (for the start end) and toward `s[-2]` (for the end end).
  - Exact construction from `a`, `b`, `s[1]`, `s[-2]` is to be implemented from this mapping; no additional interpretation is added here.

### 1.3 Player State

Each cell has exactly one Player State at a time:

| State | Meaning |
|---|---|
| `Empty` | No player action on the cell. |
| `X` | Player marked the cell as "no track" (a committed mark). |
| `TrackPreview` | A preview created by double tap; not yet a Track (see §5). |
| `Track` | A completed player Track. |
| `RedX` | A cell that received an incorrect placement; persistent and locking (see §6). |

Notes:
- `TrackPreview` is distinct from completed `Track`. A preview never counts as a completed Track for degree or win. It does count toward row/column clues (user confirmation, 2026-10-08).
- `Track ?` is an **Interaction State**, not a Player State (see §1.4 and §5.3).

### 1.4 Interaction State

- Interaction State is transient and separate from committed board state.
- It covers in-progress gesture results such as `Track ?` (a pending continuation indicator), and the current pivot during a drag.
- Interaction State is not saved as committed Player State unless the confirmed rules say so. Persistence of Interaction State is UNKNOWN (see §9).
- Track ? may persist after the finger is released (confirmed, see §5.3).

---

## 2. Input rules

### 2.1 Tap and double tap

- Single tap on `Empty` → `X`.
- Single tap on `X` → remove that `X`.
- Double tap on `Empty` → `TrackPreview`.
- Double tap on `X` → `TrackPreview`.
- Adjacent `TrackPreview` cells do **not** auto-connect.
- Tap X removes one X (one mark per tap).
- Double tap X places a `TrackPreview`.

### 2.2 Drag from Empty (batch X)

- A drag starting on `Empty` can batch-mark `X` on the cells it passes.
- **UNKNOWN:** the exact sampling rule (which cells count as "passed") and the commit timing (during drag vs. on release).

### 2.3 Drag from X (batch removal)

- Dragging from an `X` removes encountered `X` marks until the finger is released.
- **UNKNOWN:** the exact timing of each removal during the drag.

### 2.4 Drag from TrackPreview (boundary evaluation)

- A drag from `TrackPreview` evaluates on **cell-boundary crossing**.
- No state or visual change is produced merely by movement inside the current cell.
- Crossing a boundary counts toward the two-boundary rule (see §5.1).

### 2.5 Gesture thresholds

- Exact tap / double-tap threshold: **UNKNOWN**. Do not hard-code a value as confirmed behavior.

---

## 3. Board validity rules

### 3.1 Border

- A connection that points **outward** from the board border is **invalid**.

### 3.2 Degree

- Every Track cell has degree ≤ 2.
- Connections count toward degree from both Player Tracks and the Main Track (see §1.2).

### 3.3 Loops

- Loops are allowed.

### 3.4 Track shape

- A Track's shape is determined by its two connection directions:
  - opposite directions → **straight**
  - adjacent directions → **curve**

### 3.5 Solution matching

- Whether a cell is a solution Track is determined by immutable Level Solution Truth (§1.1), not by player state.

---

## 4. Track connection and degree

### 4.1 Connections

- A Track connects to neighboring cells through its two connection directions.
- A connection exists between two cells only when both ends agree (as defined by the implementation of §5 and §6; the exact per-end bookkeeping is UNKNOWN beyond this statement).

### 4.2 Main Track contribution

- A Player Track adjacent to the Main Track and connected to it counts that connection toward its own degree.

---

## 5. Two-boundary rule and Track ?

### 5.1 Two-boundary rule

- After two crossed boundaries, a `TrackPreview` becomes a completed `Track`.
- Evaluation of the two crossed directions:
  - If **both** crossed directions contain a Track → the cell becomes `Track`.
  - If **one** crossed direction does **not** contain a Track → the cell becomes `Track ?`.

### 5.2 Track ? continuation

When continuing from a `Track ?`:

1. The **origin pivot** becomes a full `Track`.
2. The **target** cell becomes the **next pivot**.
3. If the target is a valid solution Track (per Level Solution Truth), the connection is made.
4. If the target is invalid and unmarked, the target becomes `RedX` (see §6).

CONFIRMED-BY-USER (2026-10-09): Track drag into an existing player `X` preserves that mark,
whether or not the cell is on the solution path. It adds no connection and no mistake.
The drag stays active at its last valid pivot; the player may return/redirect and continue
without releasing. This does not create a connection across the marked cell. Existing `RedX`
remains locked and also does not end the drag. Tap/X-removal and double-tap behavior are unchanged.
5. The previous `Track ?` remains.

### 5.3 Track ? persistence

- `Track ?` may persist after release.

### 5.4 Rendering of Track ?

- Exact visual rendering of `Track ?`: **UNKNOWN**.

---

## 6. Mistakes, RedX, and lose

- An incorrect placement produces a **persistent RedX** on the affected cell.
- A `RedX` **locks** the affected cell until Restart.
- Maximum **3 mistakes**.
- The **third mistake** → **lose** and **input lock**.

---

## 7. Win condition

- **Win** requires:
  1. all required solution Tracks are found, and
  2. each required solution Track has **two connections**, and
  3. all solution rails, including givens, form one reciprocal entrance-to-exit path the train can traverse (user update, 2026-10-08).
- A connected path alone is **not** sufficient for win.
- Clues do **not** determine win.
- A green clue is **not** the win condition.
- **CONFIRMED-BY-USER (2026-10-08):** no win ResultPopup. After a 0.1-second pause, sweep the completed path from entrance to exit. Each cell enables its `glowingsleeper` only while the wave passes it.
- Rail group (background, icon, count) appears with opacity/scale at wave start, initially 0. Stars with MotionStreak depart at path positions 1, 4, 7... and fly to the group's world position. Each carries up to 3 rails, including the final partial batch. Total Rail counts ALL path cells, including Main Track/givens; it is not Dogdoku score and is not yet a leaderboard formula.
- Each arrival increments Rail and pulses the group. Once the wave, all flights and arrival pulses finish: hide Rail with opacity/scale, fade other Gameplay UI, move Board to the screen-centre target, run the train, then fade in the Next button. Lose ResultPopup remains unchanged.
- Legacy progression completion is still recorded once, after the train finishes. Legacy win Result/Streak/Leaderboard presentation must not interrupt this sequence. Existing leaderboard calculations are unchanged; Rail is not submitted to them.
- Wave/flight/fade/pulse durations other than the confirmed 0.1-second initial pause are editable presentation configuration, not reference-confirmed gameplay timings.
- Restart, level reload, closing Gameplay or destruction cancels outstanding effects/callbacks and restores authored HUD/Board transforms. No completion is emitted from a cancelled sequence.

---

## 8. Clues

- **CONFIRMED-BY-USER (2026-10-08):** each row shows a target number outside its left border; each column shows a target number above it.
- The target is the number of solution-path cells in that line, including Main Track and all given Tracks. No new level JSON fields are required.
- A solution cell counts as found when it is given, holds Track or TrackPreview, or has a partial Track connection (Track ?). Connection orientation and completion are not checked for clues. X, RedX and empty cells without connections do not count; off-solution occupancy never counts.
- A label turns green when every target cell in that line is found. It displays the target, not a remaining count. A zero-target line is already satisfied. Recomputed on every snapshot, including restart; clues do not change Win.
- Application publishes immutable clue summaries; Presentation only positions labels and selects configured colors. This supersedes the earlier completed-Track-only clue rule.

---

## 9. Restart

- Restart resets player actions (Player State returns to the level start, `Empty` except as defined by level start).
- Restart **preserves the Main Track** (Main Track is never reset because it is immutable).
- Restart clears RedX locks (RedX locks last until Restart).
- Restart and persistence interaction: **UNKNOWN** beyond the above.

---

## 10. Level data

### 10.1 Fields

| Field | Meaning | Status |
|---|---|---|
| `w` | Grid width | Confirmed |
| `h` | Grid height | Confirmed |
| `s` | Ordered solution path (cell indices) | Confirmed |
| `g` | Given subset containing endpoints | **UNKNOWN** semantics |
| `a` | Outward direction at `s[0]` | Confirmed |
| `b` | Outward direction at `s[-1]` | Confirmed |

### 10.2 Conventions

- Cell index: `index = y * width + x`.
- Direction bitmasks: `1 = Up`, `2 = Right`, `4 = Down`, `8 = Left`.

---

## 11. Explicit UNKNOWN register

The following are **UNKNOWN**. Do not implement them as confirmed behavior:

- Exact tap / double-tap threshold.
- Batch X sampling rule and commit timing.
- Batch X removal timing.
- `g` semantics.
- Exact reference styling of clue labels (font, spacing, color values); configurable in Presentation.
- Hint behavior.
- Place Track behavior.
- Score formula.
- Leaderboard semantics.
- Ranking, tournament, and reward behavior.
- Daily challenge.
- Tutorial flow.
- Progression and unlock semantics.
- Persistence schema.
- Exact audio mapping.
- Platform-specific Web / Facebook Instant Games behavior.
- Exact `Track ?` rendering.
- Exact event ordering and timing.
- Exact win / lose popup timing and copy.

---

## 12. Not assumed

This contract does **not** assume:

- Uniqueness of solutions.
- `g` semantics.
- Clue encoding.
- Score.
- Hints.
- Leaderboard.
- Progression.

Any of these must be confirmed explicitly before implementation.
