import { C_Drawable } from '.';
import {
    RENDER_CMD,
    RenderCommand,
    type RenderCommandStream,
    type RenderStyle,
} from '../systems/render';
import type { Position } from '../types';

const DEFAULT_ARROW_LENGTH = 1;
const DEFAULT_ARROW_ANGLE = 45;

interface ArrowTip {
    type: 'arrow';
    length?: number;
    angle?: number;
}

type Tip = ArrowTip;

export class C_Line extends C_Drawable {
    #start: Position;
    #end: Position;

    #startTip: Tip | null = null;
    #endTip: Tip | null = null;

    constructor(name: string, start: Position, end: Position, style?: RenderStyle) {
        super(name, { x: 0, y: 0 }, { x: 1, y: 1 }, style);

        this.#start = { ...start };
        this.#end = { ...end };
    }

    get start(): Position {
        return this.#start;
    }

    get end(): Position {
        return this.#end;
    }

    setStart(start: Position): this {
        this.#start = { ...start };
        return this;
    }

    setEnd(end: Position): this {
        this.#end = { ...end };
        return this;
    }

    setPoints(start: Position, end: Position): this {
        this.#start = { ...start };
        this.#end = { ...end };
        return this;
    }

    setStartTip(tip: Tip | null): this {
        this.#startTip = tip;
        return this;
    }

    setEndTip(tip: Tip | null): this {
        this.#endTip = tip;
        return this;
    }

    override queueRenderCommands(out: RenderCommandStream): void {
        if (!this.entity) {
            return;
        }

        if (this.#start.x === this.#end.x && this.#start.y === this.#end.y) {
            return;
        }

        out.push(
            new RenderCommand(RENDER_CMD.DRAW_LINE, this.style, {
                x1: this.#start.x,
                y1: this.#start.y,
                x2: this.#end.x,
                y2: this.#end.y,
            }),
        );

        this.#drawTip(this.#startTip, this.#start, -1, out);
        this.#drawTip(this.#endTip, this.#end, 1, out);
    }

    #drawTip(tip: Tip | null, origin: Position, angMult: number, out: RenderCommandStream) {
        if (tip?.type === 'arrow') {
            const { length = DEFAULT_ARROW_LENGTH } = tip;
            let { angle = DEFAULT_ARROW_ANGLE } = tip;
            angle *= angMult;
            const baseAng = Math.atan2(this.#end.x - this.#start.x, this.#end.y - this.#start.y);

            const tipStyle: RenderStyle = {
                ...this.style,
                lineCap: 'round',
                lineJoin: 'round',
            };

            out.push(
                new RenderCommand(RENDER_CMD.DRAW_LINE, tipStyle, {
                    x1: origin.x,
                    y1: origin.y,
                    x2: origin.x + Math.cos(baseAng + (angle / 180) * Math.PI) * length,
                    y2: origin.y + -Math.sin(baseAng + (angle / 180) * Math.PI) * length,
                }),
            );
            out.push(
                new RenderCommand(RENDER_CMD.DRAW_LINE, tipStyle, {
                    x1: origin.x,
                    y1: origin.y,
                    x2: origin.x + -Math.cos(baseAng + (-angle / 180) * Math.PI) * length,
                    y2: origin.y + Math.sin(baseAng + (-angle / 180) * Math.PI) * length,
                }),
            );
        }
    }
}
