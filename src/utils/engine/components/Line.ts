import { C_Drawable, type C_DrawableOptions } from '.';
import {
    RENDER_CMD,
    RenderCommand,
    type RenderCommandStream,
    type RenderStyle,
} from '../systems/render';
import { Vector, type VectorConstructor } from '../math';
import type { Engine } from '..';

const DEFAULT_ARROW_LENGTH = 1;
const DEFAULT_ARROW_ANGLE = 45;

interface ArrowTip {
    type: 'arrow';
    length?: number;
    angle?: number;
}

type Tip = ArrowTip;

interface C_LineOptions<TEngine extends Engine = Engine> extends C_DrawableOptions<TEngine> {
    start: VectorConstructor;
    end: VectorConstructor;
    startTip?: Tip;
    endTip?: Tip;
}

export class C_Line<TEngine extends Engine = Engine> extends C_Drawable<TEngine> {
    #start: Vector;
    #end: Vector;

    #startTip: Tip | null = null;
    #endTip: Tip | null = null;

    constructor(options: C_LineOptions<TEngine>) {
        super(options);

        this.#start = new Vector(options.start);
        this.#end = new Vector(options.end);
        this.#startTip = options.startTip ?? null;
        this.#endTip = options.endTip ?? null;
    }

    get start(): Vector {
        return this.#start;
    }

    get end(): Vector {
        return this.#end;
    }

    setStart(start: Vector): this {
        this.#start.set(start);
        return this;
    }

    setEnd(end: Vector): this {
        this.#end.set(end);
        return this;
    }

    setPoints(start: Vector, end: Vector): this {
        this.#start.set(start);
        this.#end.set(end);
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

        if (this.#start.equals(this.#end)) {
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

    #drawTip(tip: Tip | null, origin: Vector, angMult: number, out: RenderCommandStream) {
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
