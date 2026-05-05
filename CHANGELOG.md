# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2.0] - 2026-05-05

### Added
- EffectVibeChips: 12 Japanese vibe keyword chips above the effect type row (水中 / ローファイ / 広い / 狭い / 歪み / テープ / クリア / 電話 / ヴィンテージ / アシッド / 深い / 軽い). One tap applies a preset {type, wet, param} with a 250ms ease-out knob ramp so users learn the mapping by watching the knobs move.
- `presetDictionary.ts` with 30 keyword → effect mappings (12 surfaced as chips, 18 reserved for Phase 2B text input).
- aria-live announce of resulting type/wet/param values for 1.5s after each chip tap.
- Manual knob interaction now auto-clears the active chip highlight (drift detection).

### Changed
- EffectPanel header description now overrides briefly with the chip-applied vibe summary, then reverts to the static effect description.

## [0.1.1.0] - 2026-05-05

### Added
- BPM stepper buttons (±1) on transport bar for fine-grained tempo control
- Settings panel now visible on all viewport widths (desktop, tablet, mobile)

### Fixed
- Transport bar display settings no longer hidden on landscape mode

### Changed
- Updated design system documentation for BPM stepper styling
