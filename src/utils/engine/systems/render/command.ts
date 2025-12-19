import { HashFactory } from '../../hashFactory';
import { type RenderStyle } from './style';

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
    #buffer: Float32Array;
    #pointer: number = 0;
    #commandCount: number = 0;

    constructor(initialCapacity: number) {
        this.#buffer = new Float32Array(initialCapacity);
        this.#pointer = 0;
    }

    get buffer(): Float32Array {
        return this.#buffer;
    }

    get pointer(): number {
        return this.#pointer;
    }

    get commandCount(): number {
        return this.#commandCount;
    }

    pushValue(value: number) {
        if (this.#pointer >= this.#buffer.length) {
            const newBuffer = new Float32Array(this.#buffer.length * 2);
            newBuffer.set(this.#buffer);
            this.#buffer = newBuffer;
        }

        this.#buffer[this.#pointer++] = value;
    }

    pushCommand(command: RenderCommandType) {
        this.pushValue(command);
        this.#commandCount++;
    }

    clear() {
        this.#pointer = 0;
        this.#commandCount = 0;
    }
}

export class RenderCommandStream {
    #hashedMaterials: HashFactory<RenderStyle>;
    #hashedImages: HashFactory<string>;

    #commands: CommandBuffer = new CommandBuffer(1024);
    #currentStyleID: number | null = null;
    #currentOpacity: number = 1;

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
        this.#commands.pushCommand(RenderCommandType.PUSH_TRANSFORM);
        this.#commands.pushValue(t.a);
        this.#commands.pushValue(t.b);
        this.#commands.pushValue(t.c);
        this.#commands.pushValue(t.d);
        this.#commands.pushValue(t.e);
        this.#commands.pushValue(t.f);
    }

    popTransform() {
        this.#commands.pushCommand(RenderCommandType.POP_TRANSFORM);
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
    }
}
