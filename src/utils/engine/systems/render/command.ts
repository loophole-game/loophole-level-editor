import { HashFactory } from '../../hashFactory';
import { type RenderStyle } from './style';
import { OPACITY_THRESHOLD } from '../../utils';
import { DynamicNumberArray } from '../../dynamicNumberArray';

export const RenderCommandType = {
    PUSH_TRANSFORM: 0,
    POP_TRANSFORM: 1,
    SET_MATERIAL: 2,
    SET_OPACITY: 3,
    DRAW_RECT: 4,
    DRAW_ELLIPSE: 5,
    DRAW_LINE: 6,
    DRAW_IMAGE: 7,
} as const;
export type RenderCommandType = (typeof RenderCommandType)[keyof typeof RenderCommandType];

export interface PushTransform {
    type: typeof RenderCommandType.PUSH_TRANSFORM;
    t: DOMMatrix;
}

export type PopTransform = [
    typeof RenderCommandType.POP_TRANSFORM, // type
];

export interface SetMaterial {
    type: typeof RenderCommandType.SET_MATERIAL;
    id: number;
}

export interface SetOpacity {
    type: typeof RenderCommandType.SET_OPACITY;
    opacity: number;
}

const DEFAULT_RX = 1;
const DEFAULT_RY = 1;
const DEFAULT_GX = 1;
const DEFAULT_GY = 1;

interface DrawBase {
    x: number;
    y: number;
    x2: number;
    y2: number;
    rx?: number;
    ry?: number;
    gx?: number;
    gy?: number;
}

export interface DrawRect extends DrawBase {
    type: typeof RenderCommandType.DRAW_RECT;
}

export interface DrawEllipse extends DrawBase {
    type: typeof RenderCommandType.DRAW_ELLIPSE;
}

export interface DrawLine extends DrawBase {
    type: typeof RenderCommandType.DRAW_LINE;
}

export interface DrawImage extends DrawBase {
    type: typeof RenderCommandType.DRAW_IMAGE;
    image: number;
}

export type RenderCommand =
    | PushTransform
    | PopTransform
    | SetMaterial
    | DrawRect
    | DrawEllipse
    | DrawLine
    | DrawImage;

class CommandBuffer {
    #array: DynamicNumberArray<Float32Array>;

    #commandCount: number = 0;

    constructor(initialCapacity: number) {
        this.#array = new DynamicNumberArray(Float32Array, initialCapacity);
    }

    get buffer(): Float32Array {
        return this.#array.buffer;
    }

    get pointer(): number {
        return this.#array.length;
    }

    get commandCount(): number {
        return this.#commandCount;
    }

    pushValue(value: number) {
        this.#array.push(value);
    }

    pushCommand(command: RenderCommandType) {
        this.#array.push(command);
        this.#commandCount++;
    }

    clear() {
        this.#array.clear();
        this.#commandCount = 0;
    }
}

const TRANSFORM_COMPONENTS = 6;

export class RenderCommandStream {
    #hashedMaterials: HashFactory<RenderStyle>;
    #hashedImages: HashFactory<string>;

    #commands: CommandBuffer = new CommandBuffer(1024);
    #currentStyleID: number | null = null;
    #currentOpacity: number = 1;

    #pushTransfomStack: DynamicNumberArray<Float32Array> = new DynamicNumberArray(
        Float32Array,
        TRANSFORM_COMPONENTS * 10,
    );

    constructor(hashedMaterials: HashFactory<RenderStyle>, hashedImages: HashFactory<string>) {
        this.#hashedMaterials = hashedMaterials;
        this.#hashedImages = hashedImages;
    }

    get length(): number {
        return this.#commands.commandCount;
    }

    get commands(): Float32Array {
        return this.#commands.buffer;
    }

    get commandsLength(): number {
        return this.#commands.pointer;
    }

    pushTransform(t: DOMMatrix) {
        this.#pushTransfomStack.push(t.a);
        this.#pushTransfomStack.push(t.b);
        this.#pushTransfomStack.push(t.c);
        this.#pushTransfomStack.push(t.d);
        this.#pushTransfomStack.push(t.e);
        this.#pushTransfomStack.push(t.f);
    }

    popTransform() {
        if (this.#pushTransfomStack.length === 0) {
            this.#commands.pushCommand(RenderCommandType.POP_TRANSFORM);
        } else {
            this.#pushTransfomStack.pop(TRANSFORM_COMPONENTS);
        }
    }

    setStyle(style: RenderStyle) {
        const styleID = this.#hashedMaterials.itemToID(style);
        if (styleID === this.#currentStyleID) {
            return;
        }

        this.#currentStyleID = styleID;
        this.#commands.pushCommand(RenderCommandType.SET_MATERIAL);
        this.#commands.pushValue(styleID);
    }

    setOpacity(opacity: number) {
        if (opacity === this.#currentOpacity) {
            return;
        }

        this.#currentOpacity = opacity;
        this.#commands.pushCommand(RenderCommandType.SET_OPACITY);
        this.#commands.pushValue(opacity);
    }

    drawRect(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx?: number,
        ry?: number,
        gx?: number,
        gy?: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        this.#commands.pushCommand(RenderCommandType.DRAW_RECT);
        this.#commands.pushValue(x1);
        this.#commands.pushValue(y1);
        this.#commands.pushValue(x2);
        this.#commands.pushValue(y2);
        this.#commands.pushValue(rx ?? 1);
        this.#commands.pushValue(ry ?? 1);
        this.#commands.pushValue(gx ?? 1);
        this.#commands.pushValue(gy ?? 1);
    }

    drawEllipse(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx?: number,
        ry?: number,
        gx?: number,
        gy?: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        this.#commands.pushCommand(RenderCommandType.DRAW_ELLIPSE);
        this.#commands.pushValue(x1);
        this.#commands.pushValue(y1);
        this.#commands.pushValue(x2);
        this.#commands.pushValue(y2);
        this.#commands.pushValue(rx ?? DEFAULT_RX);
        this.#commands.pushValue(ry ?? DEFAULT_RY);
        this.#commands.pushValue(gx ?? DEFAULT_GX);
        this.#commands.pushValue(gy ?? DEFAULT_GY);
    }

    drawLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx?: number,
        ry?: number,
        gx?: number,
        gy?: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        this.#commands.pushCommand(RenderCommandType.DRAW_LINE);
        this.#commands.pushValue(x1);
        this.#commands.pushValue(y1);
        this.#commands.pushValue(x2);
        this.#commands.pushValue(y2);
        this.#commands.pushValue(rx ?? DEFAULT_RX);
        this.#commands.pushValue(ry ?? DEFAULT_RY);
        this.#commands.pushValue(gx ?? DEFAULT_GX);
        this.#commands.pushValue(gy ?? DEFAULT_GY);
    }

    drawImage(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        image: string,
        rx?: number,
        ry?: number,
        gx?: number,
        gy?: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        const imageID = this.#hashedImages.itemToID(image);
        this.#commands.pushCommand(RenderCommandType.DRAW_IMAGE);
        this.#commands.pushValue(x1);
        this.#commands.pushValue(y1);
        this.#commands.pushValue(x2);
        this.#commands.pushValue(y2);
        this.#commands.pushValue(rx ?? DEFAULT_RX);
        this.#commands.pushValue(ry ?? DEFAULT_RY);
        this.#commands.pushValue(gx ?? DEFAULT_GX);
        this.#commands.pushValue(gy ?? DEFAULT_GY);
        this.#commands.pushValue(imageID);
    }

    clear() {
        this.#commands.clear();
        this.#currentStyleID = null;
        this.#currentOpacity = 1;
        this.#pushTransfomStack.clear();
    }

    #pushDeferredTransforms() {
        for (let i = 0; i < this.#pushTransfomStack.length; i += TRANSFORM_COMPONENTS) {
            this.#commands.pushCommand(RenderCommandType.PUSH_TRANSFORM);
            this.#commands.pushValue(this.#pushTransfomStack.buffer[i]);
            this.#commands.pushValue(this.#pushTransfomStack.buffer[i + 1]);
            this.#commands.pushValue(this.#pushTransfomStack.buffer[i + 2]);
            this.#commands.pushValue(this.#pushTransfomStack.buffer[i + 3]);
            this.#commands.pushValue(this.#pushTransfomStack.buffer[i + 4]);
            this.#commands.pushValue(this.#pushTransfomStack.buffer[i + 5]);
        }

        this.#pushTransfomStack.clear();
    }
}
