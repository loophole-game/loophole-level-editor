import { HashFactory } from '../../hashFactory';
import { type RenderStyle } from './style';
import { OPACITY_THRESHOLD } from '../../utils';
import { DynamicNumberArray } from '../../dynamicNumberArray';
import type { CacheStats } from '../../types';

export const RenderCommandType = {
    PUSH_TRANSFORM: 0,
    POP_TRANSFORM: 1,
    SET_MATERIAL: 2,
    SET_OPACITY: 3,
    DRAW_RECT: 4,
    DRAW_ELLIPSE: 5,
    DRAW_LINE: 6,
    DRAW_IMAGE: 7,
    DRAW_TEXT: 8,
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

const INITIAL_COMMAND_CAPACITY = 200;
const TRANSFORM_COMPONENTS = 6;

export interface RenderCommandStats {
    setStyle: CacheStats;
    setOpacity: CacheStats;
    transform: CacheStats;
    drawRect: CacheStats;
    drawEllipse: CacheStats;
    drawLine: CacheStats;
    drawImage: CacheStats;
    drawText: CacheStats;
}

export class RenderCommandStream {
    #hashedMaterials: HashFactory<RenderStyle>;
    #hashedImages: HashFactory<string>;
    #hashedTexts: HashFactory<string>;

    #data: DynamicNumberArray<Float32Array> = new DynamicNumberArray(
        Float32Array,
        INITIAL_COMMAND_CAPACITY * 8,
    );
    #commands: DynamicNumberArray<Uint8Array> = new DynamicNumberArray(
        Uint8Array,
        INITIAL_COMMAND_CAPACITY,
    );

    #currentStyleID: number | null = null;
    #currentOpacity: number = 1;

    #pushTransformStack: DynamicNumberArray<Float32Array> = new DynamicNumberArray(
        Float32Array,
        TRANSFORM_COMPONENTS * 10,
    );

    #stats: RenderCommandStats = {
        setStyle: { total: 0, cached: 0 },
        setOpacity: { total: 0, cached: 0 },
        transform: { total: 0, cached: 0 },
        drawRect: { total: 0, cached: 0 },
        drawEllipse: { total: 0, cached: 0 },
        drawLine: { total: 0, cached: 0 },
        drawImage: { total: 0, cached: 0 },
        drawText: { total: 0, cached: 0 },
    };

    constructor(
        hashedMaterials: HashFactory<RenderStyle>,
        hashedImages: HashFactory<string>,
        hashedTexts: HashFactory<string>,
    ) {
        this.#hashedMaterials = hashedMaterials;
        this.#hashedImages = hashedImages;
        this.#hashedTexts = hashedTexts;
    }

    get data(): Float32Array {
        return this.#data.buffer;
    }

    get commands(): Uint8Array {
        return this.#commands.buffer;
    }

    get commandCount(): number {
        return this.#commands.length;
    }

    get stats(): Readonly<RenderCommandStats> | null {
        return this.#stats;
    }

    pushTransform(t: DOMMatrix) {
        this.#pushTransformStack.pushMultiple(t.a, t.b, t.c, t.d, t.e, t.f);
    }

    popTransform() {
        if (this.#pushTransformStack.length === 0) {
            this.#commands.push(RenderCommandType.POP_TRANSFORM);
            this.#stats.transform.total++;
        } else {
            this.#stats.transform.cached += 2;
            this.#pushTransformStack.pop(TRANSFORM_COMPONENTS);
        }
    }

    setStyle(style: RenderStyle) {
        const styleID = this.#hashedMaterials.itemToID(style);
        if (styleID === this.#currentStyleID) {
            this.#stats.setStyle.cached++;
            return;
        }

        this.#currentStyleID = styleID;
        this.#commands.push(RenderCommandType.SET_MATERIAL);
        this.#data.push(styleID);
        this.#stats.setStyle.total++;
    }

    setOpacity(opacity: number) {
        if (opacity === this.#currentOpacity) {
            this.#stats.setOpacity.cached++;
            return;
        }

        this.#currentOpacity = opacity;
        this.#commands.push(RenderCommandType.SET_OPACITY);
        this.#data.push(opacity);
        this.#stats.setOpacity.total++;
    }

    drawRect(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        this.#commands.push(RenderCommandType.DRAW_RECT);
        this.#data.pushMultiple(x1, y1, x2, y2, rx, ry, gx, gy);
        this.#stats.drawRect.total++;
    }

    drawEllipse(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        this.#commands.push(RenderCommandType.DRAW_ELLIPSE);
        this.#data.pushMultiple(x1, y1, x2, y2, rx, ry, gx, gy);
        this.#stats.drawEllipse.total++;
    }

    drawLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        this.#commands.push(RenderCommandType.DRAW_LINE);
        this.#data.pushMultiple(x1, y1, x2, y2, rx, ry, gx, gy);
        this.#stats.drawLine.total++;
    }

    drawImage(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        image: string,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
    ) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        const imageID = this.#hashedImages.itemToID(image);
        this.#commands.push(RenderCommandType.DRAW_IMAGE);
        this.#data.pushMultiple(x1, y1, x2, y2, rx, ry, gx, gy, imageID);
        this.#stats.drawImage.total++;
    }

    drawText(text: string, x: number, y: number) {
        if (this.#currentOpacity < OPACITY_THRESHOLD) {
            return;
        }

        this.#pushDeferredTransforms();

        const textID = this.#hashedTexts.itemToID(text);
        this.#commands.push(RenderCommandType.DRAW_TEXT);
        this.#data.pushMultiple(x, y, textID);
        this.#stats.drawText.total++;
    }

    clear() {
        this.#commands.clear();
        this.#data.clear();
        this.#pushTransformStack.clear();
        this.#currentStyleID = null;
        this.#currentOpacity = 1;
        this.#stats = {
            setStyle: { total: 0, cached: 0 },
            setOpacity: { total: 0, cached: 0 },
            transform: { total: 0, cached: 0 },
            drawRect: { total: 0, cached: 0 },
            drawEllipse: { total: 0, cached: 0 },
            drawLine: { total: 0, cached: 0 },
            drawImage: { total: 0, cached: 0 },
            drawText: { total: 0, cached: 0 },
        };
    }

    #pushDeferredTransforms() {
        const transformStat = this.#stats.transform;
        for (let i = 0; i < this.#pushTransformStack.length; i += TRANSFORM_COMPONENTS) {
            this.#commands.push(RenderCommandType.PUSH_TRANSFORM);
            this.#data.pushMultiple(
                this.#pushTransformStack.buffer[i],
                this.#pushTransformStack.buffer[i + 1],
                this.#pushTransformStack.buffer[i + 2],
                this.#pushTransformStack.buffer[i + 3],
                this.#pushTransformStack.buffer[i + 4],
                this.#pushTransformStack.buffer[i + 5],
            );
            transformStat.total++;
        }

        this.#pushTransformStack.clear();
    }
}
