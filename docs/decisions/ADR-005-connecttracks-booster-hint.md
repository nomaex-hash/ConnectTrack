# ADR-005 — ConnectTracks Hint boundary

Status: implemented within the user's authorized Hint rewrite, 2026-10-10.

Keep the existing layer direction. `domain/rules/trackHint` returns immutable deductions from
Board/SolutionTruth. `GameSession` owns a pending hint and validates Apply against the exact
board revision that produced it. Application does not accept arbitrary UI-supplied target changes.

`ConnectTracksHintView` only presents the supplied targets/evidence and emits callbacks.
`GameplayScreen` composes it with the session and the existing legacy charge/save bridge.
No new global bus, holder, service locator or Cocos dependency in Domain/Application is added.
The old Meowdoku HintSystem is not migrated or reused as a ConnectTracks rule engine.

The temporary charge bridge uses the existing PuzzleSession charge adjustment notification
with `hint=null`. It does not mutate the legacy puzzle board. A separate inventory redesign is
out of scope. Missing Editor bindings do not consume charges.

A7 is skipped by user decision. No B1 fallback is invented when the confirmed predicate has no
candidate. A8 reuses Place Track target selection without introducing new explanatory text.
