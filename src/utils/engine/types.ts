import type { RenderCommandStream } from './renderer';

export interface Renderable {
    queueRenderCommands(out: RenderCommandStream): void;
}

export type Transform = DOMMatrix;
