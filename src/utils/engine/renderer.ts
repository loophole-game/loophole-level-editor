import type { Entity } from './entities';
import type { Transform } from './types';

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

const applyStyle = (ctx: CanvasRenderingContext2D, style: RenderStyle) => {
    for (const key in style) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx as any)[key] = style[key as keyof RenderStyle];
    }
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

type DrawDataShape = {
    x: number;
    y: number;
    w: number;
    h: number;
    fill?: boolean;
    stroke?: boolean;
};
type DrawDataImage = {
    x: number;
    y: number;
    w: number;
    h: number;
    sx?: number;
    sy?: number;
    sw?: number;
    sh?: number;
};
type DrawDataText = {
    x: number;
    y: number;
    text: string;
};

type RenderCommandData = { t: Transform } | DrawDataShape | DrawDataImage | DrawDataText;

export class RenderCommand {
    #cmd: CMD;
    #style: RenderStyle;
    #zIndex: number;
    #data: RenderCommandData | null;
    #source: CanvasImageSource | null;

    constructor(
        cmd: CMD,
        style?: RenderStyle | null,
        data?: RenderCommandData | null,
        zIndex: number = 0,
        source?: CanvasImageSource | null,
    ) {
        this.#cmd = cmd;
        this.#style = style ?? {};
        this.#zIndex = zIndex;
        this.#data = data ?? null;
        this.#source = source ?? null;
    }

    get cmd(): CMD {
        return this.#cmd;
    }

    get style(): RenderStyle {
        return this.#style;
    }

    get zIndex(): number {
        return this.#zIndex;
    }

    get data(): RenderCommandData | null {
        return this.#data;
    }

    get source(): CanvasImageSource | null {
        return this.#source;
    }
}

export type RenderCommandStream = RenderCommand[];

export function renderFrame(ctx: CanvasRenderingContext2D, rootEntity: Entity) {
    const commandStreamPool: RenderCommandStream = [];
    rootEntity.queueRenderCommands(commandStreamPool);
    renderStream(ctx, commandStreamPool);
}

const renderStream = (ctx: CanvasRenderingContext2D, stream: RenderCommandStream) => {
    applyStyle(ctx, DEFAULT_RENDER_STYLE);

    for (const command of stream) {
        const { style, data } = command;
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

                const { x, y, w, h } = data;
                applyStyle(ctx, style);
                if ('fill' in data && data.fill) {
                    ctx.fillRect(x, y, w, h);
                }
                if ('stroke' in data && data.stroke) {
                    ctx.strokeRect(x, y, w, h);
                }

                break;
            }
            case RENDER_CMD.DRAW_ELLIPSE: {
                if (!data || !('w' in data)) {
                    continue;
                }

                const { x, y, w, h } = data;
                applyStyle(ctx, style);
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
