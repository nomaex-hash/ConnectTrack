# ConnectTracks

> AI Project Instructions for Claude Code

---

# Project Overview

## Project Name

ConnectTracks

## Engine

Cocos Creator 3.8.6

## Language

TypeScript

## Target Platform

- Facebook Instant Games / Web

Android is the **Reference Runtime** used to observe and verify the reference game.

Facebook Instant Games / Web is the **Target Runtime**.

Platform-specific behavior must not be assumed unless it is confirmed.

---

# Project Vision

The reference game is:

Connect Tracks: Logic Puzzle by Oakever Games.

The primary goal is **behavioral parity with the reference game**.

The project should reproduce the reference game's:

- Gameplay rules
- Player interaction
- Level progression
- UI flow
- Error handling
- Win / lose behavior
- Timing-sensitive behavior where confirmed
- State transitions
- Input behavior
- Relevant sequencing and triggers

Art, audio, typography, and other presentation details may differ unless explicitly required.

Do not introduce new gameplay behavior during MVP unless explicitly requested.

---

# Source of Truth

When making a decision, use this priority order:

1. Explicit User decision
2. Confirmed ConnectTracks gameplay contract
3. Approved architecture / ADR
4. Current task requirements
5. `AGENTS.md`
6. This `CLAUDE.md`
7. Existing implementation conventions
8. General engineering assumptions

If two sources conflict, follow the higher-priority source.

Do not silently reinterpret a confirmed gameplay rule.

---

# UNKNOWN Rule

Unknown behavior is **UNKNOWN**.

Do not invent behavior merely because it appears reasonable.

This is especially important for:

- Gameplay rules
- Timing thresholds
- Gesture sampling
- Animation timing
- Audio timing
- Hint behavior
- Score calculation
- Leaderboard semantics
- Platform-specific behavior
- Persistence behavior
- Cocos runtime behavior not yet verified

When an implementation requires an unknown behavior:

1. Keep it isolated.
2. Use the smallest reversible implementation.
3. Mark the behavior as UNKNOWN where appropriate.
4. Do not present the assumption as confirmed behavior.

Do not turn an implementation assumption into a gameplay contract.

---

# Reference Runtime and Target Runtime

## Reference Runtime

Android is used to observe the original/reference game's behavior.

Direct user observations of the reference game are treated as:

`CONFIRMED-BY-USER`

They are not equivalent to automated Android-runtime verification.

Do not claim Android-runtime verification unless such verification actually occurred.

## Target Runtime

Facebook Instant Games / Web is the target deployment environment.

Web behavior must be validated independently where relevant.

---

# Architecture

Use a layered architecture with explicit dependency direction.

```text
Bootstrap
   |
   +-------------------+
   |                   |
Presentation       Infrastructure
   |                   |
   +------> Application
                 |
                 v
              Domain
```
