import type { RenderCommandStream } from './systems/render';

export type Position = {
    x: number;
    y: number;
};

export interface Renderable {
    queueRenderCommands(out: RenderCommandStream): void;
}

export type RecursiveArray<T> = Array<RecursiveArray<T> | T>;

export interface ButtonState {
    down: boolean;
    downAsNum: number;
    pressed: boolean;
    released: boolean;
    downTime: number;
}
