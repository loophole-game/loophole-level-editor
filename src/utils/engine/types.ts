import type { IVector } from './math';
import type { RenderCommandStream } from './systems/render';

export interface BoundingBox {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}

export type RecursiveArray<T> = Array<RecursiveArray<T> | T>;

export interface ButtonState {
    down: boolean;
    downAsNum: number;
    pressed: boolean;
    released: boolean;
    downTime: number;
}

export interface CameraData {
    zoom: number;
    rotation: number;
    position: IVector<number>;
}
export interface CameraMetadata {
    dirty: boolean;
}

export interface Camera extends CameraData, CameraMetadata {}

export interface Renderable {
    queueRenderCommands(out: RenderCommandStream, camera: Camera): void;
}
