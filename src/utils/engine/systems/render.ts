import { System } from '.';
import type { Entity } from '../entities';
import type { Camera } from '../types';
import { zoomToScale } from '../utils';

export interface RenderStyle {
    fillStyle?: string | CanvasGradient | CanvasPattern;
    strokeStyle?: string | CanvasGradient | CanvasPattern;
    lineWidth?: number;
    lineJoin?: CanvasLineJoin;
    lineCap?: CanvasLineCap;
    globalAlpha?: number;
    imageSmoothingEnabled?: boolean;
}

const TRANSPARENT_STYLE = 'rgba(0, 0, 0, 0)';

export const DEFAULT_RENDER_STYLE: Required<RenderStyle> = {
    fillStyle: TRANSPARENT_STYLE,
    strokeStyle: TRANSPARENT_STYLE,
    lineWidth: 0,
    lineJoin: 'miter',
    lineCap: 'butt',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
};

const STYLE_KEYS: (keyof Required<RenderStyle>)[] = [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'lineJoin',
    'lineCap',
    'globalAlpha',
    'imageSmoothingEnabled',
];

interface Material {
    id: number;
    style: Required<RenderStyle>;
}

class MaterialCache {
    protected static _nextId: number = 1;

    #keyToMaterial: Map<string, Material> = new Map();
    #idToMaterial: Map<number, Material> = new Map();

    get size(): number {
        return this.#keyToMaterial.size;
    }

    static getStyleKey(style: RenderStyle): string {
        return STYLE_KEYS.reduce((prev, key) => {
            const styleKey = key as keyof RenderStyle;
            const value = style[styleKey] ?? DEFAULT_RENDER_STYLE[styleKey];
            return `${prev}${prev ? ',' : ''}${value}`;
        }, '');
    }

    getMaterialFromStyle(style: RenderStyle, key?: string): Material {
        const keyToUse = key ?? MaterialCache.getStyleKey(style);
        if (this.#keyToMaterial.has(keyToUse)) {
            return this.#keyToMaterial.get(keyToUse)!;
        }

        const id = MaterialCache._nextId++;
        const material = { id, style: { ...DEFAULT_RENDER_STYLE, ...style } };
        this.#keyToMaterial.set(keyToUse, material);
        this.#idToMaterial.set(id, material);

        return material;
    }

    getMaterialFromId(id: number): Material | null {
        return this.#idToMaterial.get(id) ?? null;
    }
}

export const RENDER_CMD = {
    PUSH_TRANSFORM: 'puXf',
    POP_TRANSFORM: 'poXf',
    SET_MATERIAL: 'sM',
    DRAW_RECT: 'dR',
    DRAW_ELLIPSE: 'dE',
    DRAW_LINE: 'dL',
    DRAW_IMAGE: 'dI',
} as const;
type CMD = (typeof RENDER_CMD)[keyof typeof RENDER_CMD];

export type DrawDataTransform = {
    t: DOMMatrix;
};

export type DrawDataMaterial = {
    id: number;
};

export type DrawDataShape = {
    x: number;
    y: number;
    w: number;
    h: number;
    rx?: number;
    ry?: number;
    gx?: number;
    gy?: number;
};

export type DrawDataImage = {
    x: number;
    y: number;
    w: number;
    h: number;
    img: string;
    sx?: number;
    sy?: number;
    sw?: number;
    sh?: number;
    rx?: number;
    ry?: number;
    gx?: number;
    gy?: number;
};

export type DrawDataLine = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    rx?: number;
    ry?: number;
    gx?: number;
    gy?: number;
};

export type RenderCommandData =
    | DrawDataTransform
    | DrawDataMaterial
    | DrawDataShape
    | DrawDataImage
    | DrawDataLine;

export class RenderCommand {
    #cmd: CMD;
    #data: RenderCommandData | null;
    #source: CanvasImageSource | null;

    constructor(cmd: CMD, data?: RenderCommandData | null, source?: CanvasImageSource | null) {
        this.#cmd = cmd;
        this.#data = data ?? null;
        this.#source = source ?? null;
    }

    get cmd(): CMD {
        return this.#cmd;
    }

    get data(): RenderCommandData | null {
        return this.#data;
    }

    get source(): CanvasImageSource | null {
        return this.#source;
    }
}

export class RenderCommandStream {
    #materialCache: MaterialCache;
    #commands: RenderCommand[] = [];
    #currentStyleKey: string | null = null;

    constructor(materialCache: MaterialCache) {
        this.#materialCache = materialCache;
    }

    get length(): number {
        return this.#commands.length;
    }

    get commands(): RenderCommand[] {
        return this.#commands;
    }

    push(command: RenderCommand) {
        this.#commands.push(command);
    }

    setStyle(style: RenderStyle) {
        const key = MaterialCache.getStyleKey(style);
        if (key === this.#currentStyleKey) {
            return;
        }

        this.#currentStyleKey = key;
        const material = this.#materialCache.getMaterialFromStyle(style, key);
        this.push(new RenderCommand(RENDER_CMD.SET_MATERIAL, { id: material.id }));
    }
}

export class RenderSystem extends System {
    #materialCache: MaterialCache = new MaterialCache();

    destroy(): void {}

    render(ctx: CanvasRenderingContext2D, rootEntity: Entity, camera: Camera) {
        const stream = new RenderCommandStream(this.#materialCache);
        stream.push(
            new RenderCommand(RENDER_CMD.PUSH_TRANSFORM, {
                t: new DOMMatrix()
                    .translate(camera.position.x, camera.position.y)
                    .rotate(camera.rotation)
                    .scale(zoomToScale(camera.zoom)),
            }),
        );
        rootEntity.queueRenderCommands(stream, camera);

        this.#applyStyle(ctx, DEFAULT_RENDER_STYLE);

        this._engine.trace(`renderCommands(${stream.length})`, () => {
            let activeStyle = DEFAULT_RENDER_STYLE;
            for (const command of stream.commands) {
                const { data } = command;

                if (command.cmd === RENDER_CMD.SET_MATERIAL) {
                    if (!data || !('id' in data)) {
                        continue;
                    }

                    const { id } = data;
                    const material = this.#materialCache.getMaterialFromId(id);
                    if (material) {
                        activeStyle = material.style;
                    } else {
                        console.warn(`Material with id ${id} not found`);
                    }

                    this.#applyStyle(ctx, activeStyle);

                    continue;
                }

                if (command.cmd === RENDER_CMD.PUSH_TRANSFORM) {
                    if (!data || !('t' in data)) {
                        continue;
                    }

                    const { t } = data;
                    ctx.save();
                    ctx.transform(t.a, t.b, t.c, t.d, t.e, t.f);
                }
                if (command.cmd === RENDER_CMD.POP_TRANSFORM) {
                    ctx.restore();
                    continue;
                }

                if (activeStyle.globalAlpha === 0) {
                    continue;
                }

                switch (command.cmd) {
                    case RENDER_CMD.DRAW_RECT: {
                        if (!data || !('w' in data)) {
                            continue;
                        }

                        const { x, y, w, h, rx = 1, ry = 1, gx = 1, gy = 1 } = data;

                        // Fill first so stroke remains visible on top
                        if (activeStyle.fillStyle && activeStyle.fillStyle !== TRANSPARENT_STYLE) {
                            for (let i = 0; i < rx; i++) {
                                for (let j = 0; j < ry; j++) {
                                    ctx.fillRect(x + i * gx, y + j * gy, w, h);
                                }
                            }
                        }

                        // Draw strokes without scaling line width with transform
                        if (
                            activeStyle.strokeStyle &&
                            activeStyle.strokeStyle !== TRANSPARENT_STYLE &&
                            activeStyle.lineWidth &&
                            activeStyle.lineWidth > 0
                        ) {
                            const m = ctx.getTransform();
                            const scaleX = Math.hypot(m.a, m.b);
                            const scaleY = Math.hypot(m.c, m.d);
                            const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                            const adjusted = activeStyle.lineWidth / denom;
                            const prevWidth = ctx.lineWidth;
                            ctx.lineWidth = adjusted > 0 ? adjusted : 1;

                            for (let i = 0; i < rx; i++) {
                                for (let j = 0; j < ry; j++) {
                                    ctx.strokeRect(x + i * gx, y + j * gy, w, h);
                                }
                            }

                            ctx.lineWidth = prevWidth;
                        }

                        break;
                    }
                    case RENDER_CMD.DRAW_ELLIPSE: {
                        if (!data || !('w' in data)) {
                            continue;
                        }

                        const { x, y, w, h, rx = 1, ry = 1, gx = 1, gy = 1 } = data;

                        for (let i = 0; i < rx; i++) {
                            for (let j = 0; j < ry; j++) {
                                ctx.beginPath();
                                ctx.ellipse(
                                    x + i * gx,
                                    y + j * gy,
                                    w / 2,
                                    h / 2,
                                    0,
                                    0,
                                    2 * Math.PI,
                                );
                                if (
                                    activeStyle.fillStyle &&
                                    activeStyle.fillStyle !== TRANSPARENT_STYLE
                                ) {
                                    ctx.fill();
                                }
                                if (
                                    activeStyle.strokeStyle &&
                                    activeStyle.strokeStyle !== TRANSPARENT_STYLE
                                ) {
                                    const m = ctx.getTransform();
                                    const scaleX = Math.hypot(m.a, m.b);
                                    const scaleY = Math.hypot(m.c, m.d);
                                    const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                                    const adjusted =
                                        (activeStyle.lineWidth && activeStyle.lineWidth > 0
                                            ? activeStyle.lineWidth
                                            : 1) / denom;
                                    const prevWidth = ctx.lineWidth;
                                    ctx.lineWidth = adjusted > 0 ? adjusted : 1;
                                    ctx.stroke();
                                    ctx.lineWidth = prevWidth;
                                }
                                ctx.closePath();
                            }
                        }

                        break;
                    }
                    case RENDER_CMD.DRAW_LINE: {
                        if (!data || !('x1' in data)) {
                            continue;
                        }

                        const { x1, y1, x2, y2, rx = 1, ry = 1, gx = 1, gy = 1 } = data;

                        const strokeColor = activeStyle.strokeStyle
                            ? activeStyle.strokeStyle
                            : activeStyle.fillStyle;
                        if (strokeColor !== undefined) {
                            ctx.strokeStyle = strokeColor;
                        }

                        ctx.lineWidth =
                            activeStyle.lineWidth && activeStyle.lineWidth > 0
                                ? activeStyle.lineWidth
                                : 1;

                        for (let i = 0; i < rx; i++) {
                            for (let j = 0; j < ry; j++) {
                                ctx.beginPath();
                                ctx.moveTo(x1 + i * gx, y1 + j * gy);
                                ctx.lineTo(x2 + i * gx, y2 + j * gy);
                                ctx.stroke();
                                ctx.closePath();
                            }
                        }

                        break;
                    }
                    default:
                        break;
                    case RENDER_CMD.DRAW_IMAGE: {
                        if (!data || !('img' in data)) {
                            continue;
                        }

                        const { x, y, w, h, img: imageName } = data;
                        const image = this._engine.getImage(imageName);
                        if (!image) {
                            continue;
                        }

                        ctx.drawImage(image.image, x, y, w, h);
                    }
                }
            }
        });
    }

    #applyStyle = (ctx: CanvasRenderingContext2D, style: RenderStyle) => {
        // Apply all properties without comparison since the material system
        // already deduplicates via string keys, and canvas normalizes values
        // (e.g., 'transparent' → 'rgba(0,0,0,0)') making comparisons unreliable
        Object.entries(style).forEach(([_key, value]) => {
            const key = _key as keyof CanvasRenderingContext2D;
            if (value !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ctx as any)[key] = value;
            }
        });
    };
}
