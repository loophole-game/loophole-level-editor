# Project Instructions

## Project Info

- This is a web-based level editor for a grid based time travel puzzle game called Loophole
- The main editor is built on top of a custom game engine whose source is also in this repo

## Code Style

- Use TypeScript for all new files
- Prefer functional components in React
- Don't use default exports
- Use Tailwind, ShadCN, and Lucide for web components

## High-Level Architecture

### Core Game Engine

- The custom engine lives under `src/utils/engine` and follows an Entity-Component-System style: `Entity` objects (with a built-in transform) own components and child entities, `Component`s expose rendering/collision/interaction data, and `System`s such as `RenderSystem`, `CameraSystem`, `PointerSystem`, `KeyboardSystem`, and `ImageSystem` drive updates each frame.
- Scenes are created via `SceneSystem` and host collections of entities; they are registered through `AvailableScenes` and rendered through a single `Engine` loop that manages input, updates, and batching render commands on a shared canvas.
- Utility modules (`components`, `systems`, `types`, `utils`) handle low-level math, DOM matrices, pointer/keyboard bindings, and render command queues so higher layers can focus on gameplay/editor logic.

### Loophole-Level Editor Layer

- `LevelEditor` (in `src/utils/levelEditor/index.ts`) extends `Engine` with Loophole-specific rules: it manages the current `Loophole_InternalLevel`, enforces placement constraints, wires undo/redo stacks, and keeps a pool of `E_Tile` entities (`TileScene`/`GridScene`) synced with the schema.
- Tile visuals (`E_Tile`, `E_EntityVisual`, `E_TileHighlight`, `InfiniteShape`, etc.) live in `src/utils/levelEditor/scenes` and map Loophole entities to engine entities/components (images, shapes, pointer targets, lerps) so the grid and UI layers can respond to hover/selection/brush state.
- Shared helpers (`externalLevelSchema.ts`, `utils.ts`, `stores.ts`) transform Loophole data (positions, rotations, palettes) into engine-friendly coordinates, expose metadata (sprite names, tile ownership), and expose global app stores (`getAppStore`, `getSettingsStore`) that both the editor logic and React UI consume.

### React/UI Integration

- React lives under `src/components`; the `EngineCanvas`/`LevelEditor` components initialize a `LevelEditor` instance, hook its canvas to the DOM, and forward keyboard/pointer events via the engine’s `onMouse*`/`onKey*` handlers.
- `LevelEditor` UI panels (`components/LevelEditor/*`, `OpenInterfacePanel`, `Panel`, etc.) render toolbars, tile pickers, and inspectors that read/write the stores that the engine layer also observes; they orchestrate actions such as placing tiles, updating entities, and toggling layers while keeping Loophole’s schema in sync.
- Styling follows Tailwind/ShadCN/Lucide tokens as per project style rules, and React utilities in `src/lib` or `src/utils` wrap shared helpers (e.g., sprites, palettes, data transforms) so UI and engine share the same metadata.
