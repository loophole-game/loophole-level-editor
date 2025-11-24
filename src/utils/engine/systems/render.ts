import { System } from '.';
import type { Entity } from '../entities';
import type { Camera } from '../types';

export interface RenderStyle {
    fillStyle?: string | CanvasGradient | CanvasPattern;
    strokeStyle?: string | CanvasGradient | CanvasPattern;
    lineWidth?: number;
    lineJoin?: CanvasLineJoin;
    lineCap?: CanvasLineCap;
    lineDash?: number[];
    lineDashOffset?: number;
    miterLimit?: number;
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    globalAlpha?: number;
    imageSmoothingEnabled?: boolean;
}

export const DEFAULT_RENDER_STYLE: Required<RenderStyle> = {
    fillStyle: 'white',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: 'miter',
    lineCap: 'butt',
    lineDash: [],
    lineDashOffset: 0,
    miterLimit: 10,
    shadowBlur: 0,
    shadowColor: 'black',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
};

export const RENDER_CMD = {
    PUSH_TRANSFORM: 'puXf',
    POP_TRANSFORM: 'poXf',
    DRAW_RECT: 'dR',
    DRAW_ELLIPSE: 'dE',
    DRAW_LINE: 'dL',
    DRAW_IMAGE: 'dI',
    DRAW_TEXT: 'dT',
} as const;
type CMD = (typeof RENDER_CMD)[keyof typeof RENDER_CMD];

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
export type DrawDataText = {
    x: number;
    y: number;
    text: string;
};

export type DrawDataLine = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

export type RenderCommandData =
    | { t: DOMMatrix }
    | DrawDataShape
    | DrawDataImage
    | DrawDataText
    | DrawDataLine;

export class RenderCommand {
    #cmd: CMD;
    #style: RenderStyle;
    #data: RenderCommandData | null;
    #source: CanvasImageSource | null;

    constructor(
        cmd: CMD,
        style?: RenderStyle | null,
        data?: RenderCommandData | null,
        source?: CanvasImageSource | null,
    ) {
        this.#cmd = cmd;
        this.#style = style ?? {};
        this.#data = data ?? null;
        this.#source = source ?? null;
    }

    get cmd(): CMD {
        return this.#cmd;
    }

    get style(): RenderStyle {
        return this.#style;
    }

    get data(): RenderCommandData | null {
        return this.#data;
    }

    get source(): CanvasImageSource | null {
        return this.#source;
    }
}

export type RenderCommandStream = RenderCommand[];

export class RenderSystem extends System {
    // Cache for current style state to avoid redundant updates
    #currentStyle: Partial<RenderStyle> = {};
    // Reusable render command stream to reduce allocations
    #commandStream: RenderCommandStream = [];
    // Performance metrics
    #commandCount: number = 0;
    #drawCallCount: number = 0;

    destroy(): void {
        this.#currentStyle = {};
        this.#commandStream = [];
    }

    get commandCount(): number {
        return this.#commandCount;
    }

    get drawCallCount(): number {
        return this.#drawCallCount;
    }

    render(ctx: CanvasRenderingContext2D, rootEntity: Entity, camera: Camera) {
        // Reuse stream array by clearing it
        this.#commandStream.length = 0;
        this.#commandCount = 0;
        this.#drawCallCount = 0;
        
        rootEntity.queueRenderCommands(this.#commandStream, camera);
        this.#commandCount = this.#commandStream.length;

        // Reset style tracking
        this.#currentStyle = {};
        this.#applyStyle(ctx, DEFAULT_RENDER_STYLE);

        for (const command of this.#commandStream) {
            const { style: cmdStyle, data } = command;

            switch (command.cmd) {
                case RENDER_CMD.PUSH_TRANSFORM: {
                    if (!data || !('t' in data)) {
                        continue;
                    }

                    const { t } = data;
                    ctx.save();
                    ctx.transform(t.a, t.b, t.c, t.d, t.e, t.f);

                    break;
                }
                case RENDER_CMD.POP_TRANSFORM: {
                    ctx.restore();
                    // Clear style cache after restore as context state changed
                    this.#currentStyle = {};

                    break;
                }
                case RENDER_CMD.DRAW_RECT: {
                    if (!data || !('w' in data)) {
                        continue;
                    }

                    const globalAlpha = cmdStyle.globalAlpha ?? DEFAULT_RENDER_STYLE.globalAlpha;
                    if (globalAlpha > 0) {
                        const { x, y, w, h, rx = 1, ry = 1, gx = 1, gy = 1 } = data;
                        this.#applyStyleOptimized(ctx, cmdStyle);

                        // Fill first so stroke remains visible on top
                        const fillStyle = cmdStyle.fillStyle ?? DEFAULT_RENDER_STYLE.fillStyle;
                        if (fillStyle) {
                            for (let i = 0; i < rx; i++) {
                                for (let j = 0; j < ry; j++) {
                                    ctx.fillRect(x + i * gx, y + j * gy, w, h);
                                    this.#drawCallCount++;
                                }
                            }
                        }

                        // Draw strokes without scaling line width with transform
                        const strokeStyle = cmdStyle.strokeStyle ?? DEFAULT_RENDER_STYLE.strokeStyle;
                        const lineWidth = cmdStyle.lineWidth ?? DEFAULT_RENDER_STYLE.lineWidth;
                        if (strokeStyle && lineWidth && lineWidth > 0) {
                            const m = ctx.getTransform();
                            const scaleX = Math.hypot(m.a, m.b);
                            const scaleY = Math.hypot(m.c, m.d);
                            const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                            const adjusted = lineWidth / denom;
                            const prevWidth = ctx.lineWidth;
                            ctx.lineWidth = adjusted > 0 ? adjusted : 1;

                            for (let i = 0; i < rx; i++) {
                                for (let j = 0; j < ry; j++) {
                                    ctx.strokeRect(x + i * gx, y + j * gy, w, h);
                                    this.#drawCallCount++;
                                }
                            }

                            ctx.lineWidth = prevWidth;
                        }
                    }

                    break;
                }
                case RENDER_CMD.DRAW_ELLIPSE: {
                    if (!data || !('w' in data)) {
                        continue;
                    }

                    const globalAlpha = cmdStyle.globalAlpha ?? DEFAULT_RENDER_STYLE.globalAlpha;
                    if (globalAlpha > 0) {
                        const { x, y, w, h, rx = 1, ry = 1, gx = 1, gy = 1 } = data;
                        this.#applyStyleOptimized(ctx, cmdStyle);

                        const fillStyle = cmdStyle.fillStyle ?? DEFAULT_RENDER_STYLE.fillStyle;
                        const strokeStyle = cmdStyle.strokeStyle ?? DEFAULT_RENDER_STYLE.strokeStyle;
                        const lineWidth = cmdStyle.lineWidth ?? DEFAULT_RENDER_STYLE.lineWidth;

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
                                if (fillStyle) {
                                    ctx.fill();
                                    this.#drawCallCount++;
                                }
                                if (strokeStyle) {
                                    const m = ctx.getTransform();
                                    const scaleX = Math.hypot(m.a, m.b);
                                    const scaleY = Math.hypot(m.c, m.d);
                                    const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                                    const adjusted =
                                        (lineWidth && lineWidth > 0 ? lineWidth : 1) / denom;
                                    const prevWidth = ctx.lineWidth;
                                    ctx.lineWidth = adjusted > 0 ? adjusted : 1;
                                    ctx.stroke();
                                    this.#drawCallCount++;
                                    ctx.lineWidth = prevWidth;
                                }
                                ctx.closePath();
                            }
                        }
                    }

                    break;
                }
                case RENDER_CMD.DRAW_LINE: {
                    if (!data || !('x1' in data)) {
                        continue;
                    }

                    const globalAlpha = cmdStyle.globalAlpha ?? DEFAULT_RENDER_STYLE.globalAlpha;
                    if (globalAlpha > 0) {
                        const { x1, y1, x2, y2 } = data;
                        this.#applyStyleOptimized(ctx, cmdStyle);

                        const strokeStyle = cmdStyle.strokeStyle ?? DEFAULT_RENDER_STYLE.strokeStyle;
                        const fillStyle = cmdStyle.fillStyle ?? DEFAULT_RENDER_STYLE.fillStyle;
                        const strokeColor = strokeStyle ? strokeStyle : fillStyle;
                        if (strokeColor !== undefined) {
                            ctx.strokeStyle = strokeColor;
                        }

                        const lineWidth = cmdStyle.lineWidth ?? DEFAULT_RENDER_STYLE.lineWidth;
                        ctx.lineWidth = lineWidth && lineWidth > 0 ? lineWidth : 1;

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                        ctx.closePath();
                        this.#drawCallCount++;
                    }

                    break;
                }
                default:
                    break;
                case RENDER_CMD.DRAW_IMAGE: {
                    if (!data || !('img' in data)) {
                        continue;
                    }

                    const globalAlpha = cmdStyle.globalAlpha ?? DEFAULT_RENDER_STYLE.globalAlpha;
                    if (globalAlpha > 0) {
                        const { x, y, w, h, img: imageName } = data;
                        this.#applyStyleOptimized(ctx, cmdStyle);
                        const image = this._engine.getImage(imageName);
                        if (!image) {
                            continue;
                        }
                        ctx.drawImage(image.image, x, y, w, h);
                        this.#drawCallCount++;
                    }
                }
            }
        }
    }

    #applyStyle = (ctx: CanvasRenderingContext2D, style: RenderStyle) => {
        Object.entries(style).forEach(([key, value]) => {
            if (value !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ctx as any)[key] = value;
                this.#currentStyle[key as keyof RenderStyle] = value;
            }
        });
    };

    // Optimized style application - only update changed properties
    #applyStyleOptimized = (ctx: CanvasRenderingContext2D, style: RenderStyle) => {
        // First apply all properties from DEFAULT_RENDER_STYLE with incoming style overrides
        for (const key in DEFAULT_RENDER_STYLE) {
            const styleKey = key as keyof RenderStyle;
            const value = style[styleKey] ?? DEFAULT_RENDER_STYLE[styleKey];
            if (value !== undefined && this.#currentStyle[styleKey] !== value) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ctx as any)[key] = value;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this.#currentStyle as any)[styleKey] = value;
            }
        }
        
        // Then apply any additional properties from incoming style not in DEFAULT_RENDER_STYLE
        for (const key in style) {
            if (Object.prototype.hasOwnProperty.call(style, key) && !(key in DEFAULT_RENDER_STYLE)) {
                const value = style[key as keyof RenderStyle];
                if (value !== undefined && this.#currentStyle[key as keyof RenderStyle] !== value) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (ctx as any)[key] = value;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this.#currentStyle as any)[key] = value;
                }
            }
        }
    };
}
