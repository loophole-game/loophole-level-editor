import type { Entity } from '../entities';

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
}

export const DEFAULT_RENDER_STYLE: Required<RenderStyle> = {
    fillStyle: 'white',
    strokeStyle: 'black',
    lineWidth: 1,
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
};

export const RENDER_CMD = {
    PUSH_TRANSFORM: 'puXf',
    POP_TRANSFORM: 'poXf',
    DRAW_RECT: 'dR',
    DRAW_ELLIPSE: 'dE',
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
};
export type DrawDataImage = {
    x: number;
    y: number;
    w: number;
    h: number;
    sx?: number;
    sy?: number;
    sw?: number;
    sh?: number;
    rx?: number;
    ry?: number;
};
export type DrawDataText = {
    x: number;
    y: number;
    text: string;
};

export type RenderCommandData = { t: DOMMatrix } | DrawDataShape | DrawDataImage | DrawDataText;

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

export class RenderSystem {
    render = (ctx: CanvasRenderingContext2D, rootEntity: Entity) => {
        const stream: RenderCommandStream = [];
        rootEntity.queueRenderCommands(stream);

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

                    const { x, y, w, h, rx = 1, ry = 1 } = data;
                    this.#applyStyle(ctx, style);

                    // Draw strokes as a single path to avoid overlapping
                    if (style.strokeStyle && style.lineWidth && style.lineWidth > 0) {
                        for (let i = 0; i < rx; i++) {
                            for (let j = 0; j < ry; j++) {
                                ctx.strokeRect(
                                    x + i * (w + style.lineWidth / 2),
                                    y + j * (h + style.lineWidth / 2),
                                    w,
                                    h,
                                );
                            }
                        }
                    }

                    // Draw fills first
                    if (style.fillStyle) {
                        for (let i = 0; i < rx; i++) {
                            for (let j = 0; j < ry; j++) {
                                ctx.fillRect(
                                    x + i * (w + style.lineWidth / 2),
                                    y + j * (h + style.lineWidth / 2),
                                    w,
                                    h,
                                );
                            }
                        }
                    }

                    break;
                }
                case RENDER_CMD.DRAW_ELLIPSE: {
                    if (!data || !('w' in data)) {
                        continue;
                    }

                    const { x, y, w, h } = data;
                    this.#applyStyle(ctx, style);
                    ctx.beginPath();
                    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 2 * Math.PI);
                    if ('fill' in data && data.fill) {
                        ctx.fill();
                    }
                    if ('stroke' in data && data.stroke) {
                        ctx.stroke();
                    }
                    ctx.closePath();

                    break;
                }
                default:
                    break;
            }
        }
    };

    #applyStyle = (ctx: CanvasRenderingContext2D, style: RenderStyle) => {
        Object.entries(style).forEach(([key, value]) => {
            if (value !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ctx as any)[key] = value;
            }
        });
    };
}
