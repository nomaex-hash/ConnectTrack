# ConnectTracks — Booster Hint revision

Status: implemented for the specified predicates after the user's “ok giờ viết code đi”.
Editor wiring and runtime verification are pending. Unspecified extensions below remain unimplemented.
Source: explicit user request, 2026-10-10. This document does not claim runtime verification.

## Confirmed interaction contract

- Phase A: at least one answer track has not been identified by the player.
- Phase B: all answer tracks have been identified; the player is completing connections.
- TrackPreview, Track? and fully shaped tracks count as identified tracks.
- Evaluate phase A rules in order A0 through A8. A7 is explicitly skipped for now.
  A6 includes the forced-connection condition clarified by the user's image below. Phase B uses B1.
- Showing a hint previews the proposed change. Apply commits the change.
- Use the supplied colored sprites unchanged; do not tint them in code.
- Lift the specified evidence cells and target cells. Orthogonally adjacent lifted cells form
  one region; draw a gray outer boundary per region, without internal shared edges.
- Red borders indicate incorrect player state; green borders indicate proposed deductions.

## Rules confirmed by user

| Rule | Detection | Lift/preview | Apply | Text |
|---|---|---|---|---|
| A0 | Player X occupies an answer-track cell | Red outline on the incorrect cell | Remove X | Ô này đã bị đánh dấu sai. |
| A1 | A fixed given port points to an in-board neighbor not yet identified as track | Lift given and target; green target outline and gray TrackPreview sprite | Place TrackPreview on target | Đường ray phải nối vào đây, nên ô này là đường ray |
| A2 | Known track count equals row/column clue; unmarked cells remain | Lift the entire line; green outlines and gray X sprites on targets | Mark targets X | Hàng đã đạt con số, nên các ô còn lại không thể là đường ray. |
| A3 | A track has an adjacent track and two blocked directions | Lift source track, blocking player-marked cells and remaining target; green outline and gray preview on target | Place TrackPreview on target | Mọi hướng khác đều bị chặn, nên đường ray phải nối vào đây. |
| A4 | Number of cells not marked X equals the row/column clue | Lift the entire line; green outlines and gray track sprites on remaining targets | Place TrackPreview on remaining cells | Để đạt con số của hàng, các ô còn lại phải là đường ray. |
| A5 | An unmarked candidate has three blocked directions | Lift candidate and blocking player-marked cells; green outline and gray X on candidate | Mark candidate X | Ô này chỉ có một kết nối nên không thể là đường ray. |
| A6 | A line needs exactly one more track. An unmarked candidate has exactly two available connection directions; using both forces another not-yet-identified track in that same line, exceeding its clue. | Lift entire line; green outline and gray X on candidate | Mark candidate X | đường ray ở đây phải nối với 1 đường ray khác trong hàng/ cột. Điều đó sẽ vượt quá con số nên không thể là đường ray |
| A7 — skipped by user | Do not evaluate in this revision | None | None | None |
| A8 | No preceding phase-A rule matches | Fallback to existing Place Track selection logic | Place one track as existing Place Track does | Not supplied |
| B1 preview | Find a preview adjacent to a given; alternatively, adjacent to a player track whose orientation is correct | Lift target plus player-marked cells among its four orthogonal neighbors. Only target has a green border and correctly oriented gray track sprite; lifted marks have no green border. | Set correct track orientation at target | Đường ray phải nối với các ô liền kề, nên hướng của nó đã rõ |
| B1 wrong shape | No previews remain, but the path is disconnected due to wrong orientation | Lift only the wrong track; red border and correctly oriented gray track | Correct that cell's orientation | Đường ray này đang hướng sai. |

Blocked directions specified for A3/A5: board boundary, correctly marked non-track cell, or
given neighbor with no port toward the candidate. Given entrance/exit has one in-board port;
interior givens have two. Off-board ports cannot produce a target cell.

## Open decisions — not assumptions

1. The proposed answer-data guard for A4–A6 was NOT approved. A6 is now explained by forced
   connections and line capacity; do not add a separate answer-data filter silently.
2. B1: retain the original requirement that the correct neighboring port points into the
   preview. Merely touching an unrelated given is insufficient. If no candidate matches,
   return no hint and consume no charge; no broader wrong-shape fallback while previews remain.
3. A8's description text was not supplied. Implementation applies the existing Place Track
   target directly without inventing a description or presenting an empty explanation panel.
4. A4 mutates only Empty candidates, never erasing existing track links. RedX remains the
   existing locked non-track state and is excluded from the remaining-candidate count.

Implementation details, not new reference-confirmed behavior: stable row-before-column and
reading-order selection for equivalent deductions; synchronous lift preserving world transform;
charge on successful display as in the existing Hint system. Editor steps and runtime checklist:
`docs/development/connecttracks-hint-editor.md`.

## User clarification — 2026-10-10

- A7: “Tạm bỏ qua A7”. This is an intentional exclusion, not an invented rule.
- A6: user's image and explanation establish the two-available-directions case below.
- B1: search neighbors for a given or correctly oriented player track. Preview the correct
  gray shape on the target with its green border; lift adjacent player marks as context without
  green borders. Apply changes only the target. Do not automatically lift a neighboring track
  merely because it supplied evidence; the clarified lift set is target plus marked neighbors.

## A6 — forced connection exceeds the line clue

Evidence: user-provided screenshot and explanation, 2026-10-10. Coordinates in this example
are one-based. This confirms the described behavior, not an independently executed runtime test.

1. Row 2 has clue 2 and one already identified track, so its remaining capacity is 1.
2. Target is row 2, column 1; it is still unmarked before the hint preview.
3. Up is blocked by the player's X at row 1, column 1. Left is blocked by the board edge.
4. Exactly two directions remain: Down and Right. A hypothetical track at the target needs
   both directions to satisfy degree 2.
5. Right leads to row 2, column 2, which is not an identified track. Therefore the assumption
   requires TWO additional track cells in row 2: the target and that neighbor.
6. Two additional tracks exceed remaining capacity 1, so the target cannot be a track.
7. Lift row 2. Preview the existing gray X sprite and green outline only on the target.
   The blocking cell in row 1 is reasoning evidence, not an extra lifted cell for A6.
8. Apply marks only the target X. Do not place either of the hypothetical tracks.

For a column, use the same line-capacity reasoning with row/column axes exchanged. Count given,
TrackPreview, Track? and Track as known tracks. Count the forced neighboring track as additional
only when it is not already known. Use the established blocked-direction definition; A0 has
priority to remove incorrect player X marks before subsequent deductions.

The confirmed implementation case requires exactly two available directions. Do not extend it
to arbitrary multi-cell hypothetical searches without a separate confirmed rule.

Acceptance cases:

- The pictured target yields A6 if no higher-priority A0–A5 hint applies elsewhere.
- Removing the upper X allows a vertical continuation: this target must not yield A6 merely
  because its horizontal neighbors are not tracks.
- If the forced same-line neighbor is already a track, placing the candidate adds only one:
  this capacity contradiction does not apply.
- If the line has room for two more tracks, this contradiction does not apply.
- If fewer than two directions remain, evaluate A5 as specified; do not relabel it A6.
- Transpose the pictured setup to a column and verify the corresponding column deduction.

## Repository findings

- `GameplayScreen.onTapHint()` currently sends legacy `IntentType.ShowHint` to
  `PuzzleSessionHolder.current`, not the ConnectTracks GameSession.
- Legacy `HintSystem` implements Star Battle/Meowdoku deductions. It is not the new rule engine.
- Legacy `HintController` depends on legacy BoardView/PuzzleSessionHolder and cannot be copied
  unchanged as the ConnectTracks presentation layer.
- `GameSession` owns the ConnectTracks board/solution and already implements `placeTrack`.
- `needsConnectionHint` is the existing three-second connection reminder, not this booster.
- Hint track sprites exist under `assets/textures/ConnectTrack/item_hint_track*`; actual Editor
  bindings and target/region border assets must be checked, not inferred from filenames alone.

## Implementation boundaries

- Domain: pure ordered hint deductions over board/solution; no Cocos, UI, inventory or global bus.
- Application: owns pending hint and Apply validation; reject stale hints after state changes;
  apply batch targets atomically; retain existing mistake, win and persistence behavior.
- Presentation: render returned evidence/targets, lift/restore cells, draw region boundary,
  display exact approved text and emit Apply/Close callbacks. It does not choose a deduction.
- Existing screen composition connects GameSession, hint view and charge inventory. Preserve
  existing charge/ad policy; no new networking, ad framework or legacy tree migration.
- Closing screen, restart, level change or destruction must restore lifted cells and clear previews.
- No scene/prefab edits by Codex; document the necessary Editor wiring for the user.

## Required verification

- Priority and phase transition; A0 before deductions affected by wrong X.
- Each confirmed rule with positive and negative cases, givens, edges, rectangular boards.
- A6 counterexample: vertical track with no track neighbor along its row.
- B1 preview, Track?, wrong shape and the unresolved no-correct-incoming-connection case.
- Showing a hint never changes board state; Apply changes only targets; stale/double Apply rejected.
- Reuse Place Track's selection for A8, including tie-breaking.
- No sprite tint; connected lifted regions have only perimeter edges.
- Restore parent/order/transform on close, restart, next level and destroy.
- Correct charge handling, persistence, win transition and gameplay input blocking while previewing.
- Scoped unit tests/typecheck, then manual Cocos verification of assets and animation.
