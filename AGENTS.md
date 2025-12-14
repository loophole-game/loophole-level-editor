# Project Instructions

## Project Info

- This is a web-based level editor for a grid based time travel puzzle game called Loophole
- The main editor is built on top of a custom game engine whose source is also in this repo

## High-Level Architecture

### Core Game Engine

- The custom engine lives under `src/utils/engine` and follows an Entity-Component-System style: `Entity` objects (with a built-in transform) own components and child entities, `Component`s expose rendering/collision/interaction data, and `System`s such as `RenderSystem`, `CameraSystem`, `PointerSystem`, `KeyboardSystem`, and `ImageSystem` drive updates each frame.
- Scenes are created via `SceneSystem` and host collections of entities; they are instantiated directly from their class constructors and rendered through a single `Engine` loop that manages input, updates, and batching render commands on a shared canvas.
- Utility modules (`components`, `systems`, `types`, `utils`) handle low-level math, DOM matrices, pointer/keyboard bindings, and render command queues so higher layers can focus on gameplay/editor logic.

### Loophole-Level Editor Layer

- `LevelEditor` (in `src/utils/levelEditor/index.ts`) extends `Engine` with Loophole-specific rules: it manages the current `Loophole_InternalLevel`, enforces placement constraints, wires undo/redo stacks, and keeps a pool of `E_Tile` entities (`TileScene`/`GridScene`) synced with the schema.
- Tile visuals (`E_Tile`, `E_EntityVisual`, `E_TileHighlight`, `InfiniteShape`, etc.) live in `src/utils/levelEditor/scenes` and map Loophole entities to engine entities/components (images, shapes, pointer targets, lerps) so the grid and UI layers can respond to hover/selection/brush state.
- Shared helpers (`externalLevelSchema.ts`, `utils.ts`, `stores.ts`) transform Loophole data (positions, rotations, palettes) into engine-friendly coordinates, expose metadata (sprite names, tile ownership), and expose global app stores (`getAppStore`, `getSettingsStore`) that both the editor logic and React UI consume.

### React/UI Integration

- React lives under `src/components`; the `EngineCanvas`/`LevelEditor` components initialize a `LevelEditor` instance, hook its canvas to the DOM, and forward keyboard/pointer events via the engine’s `onMouse*`/`onKey*` handlers.
- `LevelEditor` UI panels (`components/LevelEditor/*`, `OpenInterfacePanel`, `Panel`, etc.) render toolbars, tile pickers, and inspectors that read/write the stores that the engine layer also observes; they orchestrate actions such as placing tiles, updating entities, and toggling layers while keeping Loophole’s schema in sync.
- Styling follows Tailwind/ShadCN/Lucide tokens as per project style rules, and React utilities in `src/lib` or `src/utils` wrap shared helpers (e.g., sprites, palettes, data transforms) so UI and engine share the same metadata.

## General Development Rules

- Prefer **small, focused changes** that respect the existing ECS and level-editor architecture instead of introducing new one-off patterns.
- Keep **gameplay and rendering logic** inside the engine and level-editor layers in `src/utils` (components, systems, scenes), not in React components.
- Keep **UI state and side effects** in React and the `zustand` stores in `src/utils/stores.ts`, not in the engine core.
- Preserve and extend **strong TypeScript typing**; avoid `any`/`as` and keep public APIs typed and stable where possible.
- Follow the existing **directory conventions**:
  - Engine core under `src/utils/engine/**`
  - Level-editor behavior and visuals under `src/utils/levelEditor/**`
  - React UI under `src/components/**`
- Prefer **reusing existing helpers** in `src/utils/levelEditor/utils.ts`, `externalLevelSchema.ts`, and `stores.ts` instead of duplicating logic.
- When adding new visual entities or behaviors, **mirror the existing scene/entity/component patterns** used by `E_Tile`, `E_EntityVisual`, and other level-editor scenes.

## Engine & Level Editor Specific Rules

- Treat `LevelEditor` (`src/utils/levelEditor/index.ts`) as the **single source of truth** for:
  - The current `Loophole_InternalLevel`
  - Placement rules and constraints
  - Undo/redo behavior
- Avoid mutating level data outside of the paths that `LevelEditor` and the existing stores already use; **route changes through existing APIs** when possible.
- For new interactions:
  - Put **input handling** in the appropriate engine systems (`pointer`, `keyboard`, `cursor`).
  - Put **visual/animation concerns** into components (`Image`, `Shape`, `Lerp`, etc.).
  - Keep **editor-specific behavior** (selection, brushes, layers) in the level-editor scenes under `src/utils/levelEditor/scenes/**`.
- When editing or extending `src/utils/levelEditor/scenes/ui.ts`, prefer:
  - Using existing store selectors and actions instead of creating new global state.
  - Keeping time-travel and multi-timeline behavior consistent with existing patterns (e.g., don't special-case a single timeline unless clearly required).

## React/UI Rules

- Use **functional components** with hooks; avoid class components.
- Use the existing **ShadCN/Tailwind pattern** from `src/components/ui/**` (`Button`, `Input`, `Tooltip`, etc.) for new UI instead of raw HTML wherever reasonable.
- Keep React components **presentational where possible** and delegate game/editor logic to the engine and level-editor utilities.
- For layout and styling:
  - Use existing Tailwind tokens and utility classes as a reference to match the current visual style.
  - Keep the editor layout responsive enough to work at common desktop resolutions.

## Tooling & Commands (for agents)

- Use **pnpm** for all commands in this repo:
  - `pnpm dev` to run the Vite dev server.
  - `pnpm build` to build the app.
  - `pnpm lint` to run ESLint.
  - `pnpm type-check` to run TypeScript in build mode without emitting.
- Before landing substantial changes, prefer to **run at least lint and type-check** and address new issues in the touched files.
- Never modify the available scripts or pre-commit hook unless explicitly asked

## Useful Default Actions for This Project

- When asked to **add or change a feature in the editor**:
  - Identify whether the change belongs in the engine (`src/utils/engine/**`), level-editor layer (`src/utils/levelEditor/**`), or React UI (`src/components/**`), and keep the change focused to the correct layer.
  - Favor extending existing entities, components, and scenes over introducing entirely new patterns.
- When asked to **debug editor behavior**:
  - First inspect the relevant scene or system (for grid/selection issues, look in `src/utils/levelEditor/scenes/**` and the corresponding engine systems).
  - Only fall back to UI-level workarounds if the bug clearly originates in React.
- When asked to **add new tiles, entities, or visual states**:
  - Wire them into the level schema (`externalLevelSchema.ts` if applicable).
  - Add or extend corresponding entities/visuals in `src/utils/levelEditor/scenes`.
  - Ensure the React UI (tile picker, inspectors, layers) exposes the new options where appropriate.
- When in doubt about where something should live, **prefer consistency with similar existing code** in this repo over inventing a new pattern.
