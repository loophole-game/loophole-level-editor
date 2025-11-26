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
    destroy(): void {}

    render(ctx: CanvasRenderingContext2D, rootEntity: Entity, camera: Camera) {
        const stream: RenderCommandStream = [];
        rootEntity.queueRenderCommands(stream, camera);

        this.#applyStyle(ctx, DEFAULT_RENDER_STYLE);

        for (const command of stream) {
            const { style: _style, data } = command;
            const style = { ...DEFAULT_RENDER_STYLE, ..._style };

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

                    break;
                }
                case RENDER_CMD.DRAW_RECT: {
                    if (!data || !('w' in data)) {
                        continue;
                    }

                    if (style.globalAlpha > 0) {
                        const { x, y, w, h, rx = 1, ry = 1, gx = 1, gy = 1 } = data;
                        this.#applyStyle(ctx, style);

                        // Fill first so stroke remains visible on top
                        if (style.fillStyle) {
                            for (let i = 0; i < rx; i++) {
                                for (let j = 0; j < ry; j++) {
                                    ctx.fillRect(x + i * gx, y + j * gy, w, h);
                                }
                            }
                        }

                        // Draw strokes without scaling line width with transform
                        if (style.strokeStyle && style.lineWidth && style.lineWidth > 0) {
                            const m = ctx.getTransform();
                            const scaleX = Math.hypot(m.a, m.b);
                            const scaleY = Math.hypot(m.c, m.d);
                            const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                            const adjusted = style.lineWidth / denom;
                            const prevWidth = ctx.lineWidth;
                            ctx.lineWidth = adjusted > 0 ? adjusted : 1;

                            for (let i = 0; i < rx; i++) {
                                for (let j = 0; j < ry; j++) {
                                    ctx.strokeRect(x + i * gx, y + j * gy, w, h);
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

                    if (style.globalAlpha > 0) {
                        const { x, y, w, h, rx = 1, ry = 1, gx = 1, gy = 1 } = data;
                        this.#applyStyle(ctx, style);

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
                                if (style.fillStyle) {
                                    ctx.fill();
                                }
                                if (style.strokeStyle) {
                                    const m = ctx.getTransform();
                                    const scaleX = Math.hypot(m.a, m.b);
                                    const scaleY = Math.hypot(m.c, m.d);
                                    const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                                    const adjusted =
                                        (style.lineWidth && style.lineWidth > 0
                                            ? style.lineWidth
                                            : 1) / denom;
                                    const prevWidth = ctx.lineWidth;
                                    ctx.lineWidth = adjusted > 0 ? adjusted : 1;
                                    ctx.stroke();
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

                    if (style.globalAlpha > 0) {
                        const { x1, y1, x2, y2 } = data;
                        this.#applyStyle(ctx, style);

                        const strokeColor = style.strokeStyle ? style.strokeStyle : style.fillStyle;
                        if (strokeColor !== undefined) {
                            ctx.strokeStyle = strokeColor;
                        }

                        ctx.lineWidth =
                            style.lineWidth && style.lineWidth > 0 ? style.lineWidth : 1;

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                        ctx.closePath();
                    }

                    break;
                }
                default:
                    break;
                case RENDER_CMD.DRAW_IMAGE: {
                    if (!data || !('img' in data)) {
                        continue;
                    }

                    if (style.globalAlpha > 0) {
                        const { x, y, w, h, img: imageName } = data;
                        this.#applyStyle(ctx, style);
                        const image = this._engine.getImage(imageName);
                        if (!image) {
                            continue;
                        }
                        ctx.drawImage(image.image, x, y, w, h);
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
            }
        });
    };
}
