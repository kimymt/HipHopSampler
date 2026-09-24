# Repository Guidelines

## Project Structure & Module Organization

The application lives in `sampler-tool/`; run development commands there. React UI is in `src/components/`, state and browser integration in `src/hooks/`, audio effects in `src/effects/`, and reusable logic in `src/utils/`. Static PWA assets and the AudioWorklet script are in `public/`. Tests sit beside their source files. Read `sampler-tool/DESIGN.md` before changing UI, copy, colors, or interaction patterns.

## Build, Test, and Development Commands

From `sampler-tool/`, run `npm install` to install the lockfile dependencies and `npm run dev` to start Vite locally. `npm run build` creates the production bundle in `dist/`; `npm run preview` serves that bundle. Run `npm test` for the Vitest suite, `npm run lint` for ESLint, and `npm run typecheck` for TypeScript checks. Run all three checks before opening a pull request.

## Coding Style & Naming Conventions

Follow the surrounding file's formatting; the repository has no formatter command and contains both JavaScript and TypeScript. Use two-space indentation. Name React components in PascalCase (`PadGrid.tsx`), hooks with a `use` prefix (`useAudioEngine.ts`), and tests after the module (`PadGrid.test.tsx`). Keep audio and persistence behavior in hooks or focused utilities rather than adding it to `App.tsx`. Use CSS variables from `DESIGN.md`; avoid hard-coded colors. UI wording should suit a first-time sampler user and avoid unexplained DAW terminology.

## Testing Guidelines

Vitest runs `src/**/*.{test,spec}.{js,jsx,ts,tsx}` in `happy-dom`; component tests use React Testing Library. Add focused tests for changed audio logic, hooks, and user interactions. Browser audio, touch behavior, service workers, and offline use need manual checks on relevant devices because the unit environment does not exercise them. Report which devices and browsers were actually tested.

## Commit & Pull Request Guidelines

Recent commits use concise prefixes such as `fix(pads):`, `feat(reference):`, `refactor(app):`, and `docs:`. Keep each commit focused. In a pull request, describe the user-visible change, link an issue when one exists, list checks run, and attach screenshots or a short recording for UI changes. State any remaining real-device validation explicitly.
