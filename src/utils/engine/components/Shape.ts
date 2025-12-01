import {
    RENDER_CMD,
    RenderCommand,
    type DrawDataLine,
    type DrawDataShape,
    type RenderCommandStream,
    type RenderStyle,
} from '../systems/render';
import { Vector, type IVector, type VectorConstructor } from '../math';
import { C_Drawable, type C_DrawableOptions } from './index';
import type { Engine } from '..';

const DEFAULT_ARROW_LENGTH = 1;
const DEFAULT_ARROW_ANGLE = 45;

export type Shape = 'RECT' | 'ELLIPSE' | 'LINE';

export interface ArrowTip {
    type: 'arrow';
    length?: number;
    angle?: number;
}

export type Tip = ArrowTip;

export interface C_ShapeOptions<TEngine extends Engine = Engine>
    extends C_DrawableOptions<TEngine> {
    shape: Shape;
    repeat?: VectorConstructor;
    gap?: VectorConstructor;
    start?: VectorConstructor;
    end?: VectorConstructor;
    startTip?: Tip;
    endTip?: Tip;
}

export class C_Shape<TEngine extends Engine = Engine> extends C_Drawable<TEngine> {
    #shape: Shape;
    #repeat: Vector | null;
    #gap: Vector | null;

    #start: Vector | null = null;
    #end: Vector | null = null;

    #startTip: Tip | null = null;
    #endTip: Tip | null = null;

    constructor(options: C_ShapeOptions<TEngine>) {
        const {
            name = 'shape',
            shape,
            repeat,
            gap,
            start,
            end,
            startTip,
            endTip,
            ...rest
        } = options;
        super({ name, ...rest });

        this.#shape = shape;
        this.#repeat = repeat !== undefined ? new Vector(repeat) : null;
        this.#gap = gap !== undefined ? new Vector(gap) : null;

        if (start) this.#start = new Vector(start);
        if (end) this.#end = new Vector(end);
        this.#startTip = startTip ?? null;
        this.#endTip = endTip ?? null;
    }

    get shape(): Shape {
        return this.#shape;
    }

    set shape(shape: Shape) {
        this.#shape = shape;
        if (shape === 'ELLIPSE') {
            this.setOrigin(new Vector(0, 0));
        } else if (shape === 'RECT') {
            this.setOrigin(new Vector(0.5, 0.5));
        }
    }

    get repeat(): Vector | null {
        return this.#repeat;
    }

    set repeat(repeat: VectorConstructor | null) {
        this.#repeat = repeat !== null ? new Vector(repeat) : null;
    }

    get gap(): Vector | null {
        return this.#gap;
    }

    set gap(gap: VectorConstructor | null) {
        this.#gap = gap !== null ? new Vector(gap) : null;
    }

    get start(): Vector | null {
        return this.#start;
    }

    get end(): Vector | null {
        return this.#end;
    }

    setStart(start: IVector<number>): this {
        if (!this.#start) {
            this.#start = new Vector(start);
        } else {
            this.#start.set(start);
        }
        return this;
    }

    setEnd(end: IVector<number>): this {
        if (!this.#end) {
            this.#end = new Vector(end);
        } else {
            this.#end.set(end);
        }
        return this;
    }

    setPoints(start: IVector<number>, end: IVector<number>): this {
        this.setStart(start);
        this.setEnd(end);
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
        if (!this.entity?.transform) {
            return;
        }

        switch (this.#shape) {
            case 'LINE': {
                if (!this.#start || !this.#end) {
                    return;
                }
                if (this.#start.equals(this.#end)) {
                    return;
                }

                const data: DrawDataLine = {
                    x1: this.#start.x,
                    y1: this.#start.y,
                    x2: this.#end.x,
                    y2: this.#end.y,
                };
                const extraData: Partial<DrawDataLine> = {};
                if (this.#repeat) {
                    extraData.rx = this.#repeat.x;
                    extraData.ry = this.#repeat.y;
                    if (this.#gap) {
                        extraData.gx = this.#gap.x;
                        extraData.gy = this.#gap.y;
                    }
                }

                out.push(
                    new RenderCommand(RENDER_CMD.DRAW_LINE, this.style, {
                        ...data,
                        ...extraData,
                    }),
                );

                this.#drawTip(this.#startTip, this.#start, -1, out, extraData);
                this.#drawTip(this.#endTip, this.#end, 1, out, extraData);

                break;
            }
            case 'RECT': {
                const data: DrawDataShape = {
                    x: (-1 - (this._scale.x - 1)) * this._origin.x,
                    y: (-1 - (this._scale.y - 1)) * this._origin.y,
                    w: this._scale.x,
                    h: this._scale.y,
                };
                if (this.#repeat) {
                    data.rx = this.#repeat.x;
                    data.ry = this.#repeat.y;
                    if (this.#gap) {
                        data.gx = this.#gap.x;
                        data.gy = this.#gap.y;
                    }
                }

                out.push(new RenderCommand(RENDER_CMD.DRAW_RECT, this.style, data));

                break;
            }
            case 'ELLIPSE': {
                const data: DrawDataShape = {
                    x: (-1 - (this._scale.x - 1)) * this._origin.x,
                    y: (-1 - (this._scale.y - 1)) * this._origin.y,
                    w: this._scale.x,
                    h: this._scale.y,
                };
                if (this.#repeat) {
                    data.rx = this.#repeat.x;
                    data.ry = this.#repeat.y;
                    if (this.#gap) {
                        data.gx = this.#gap.x;
                        data.gy = this.#gap.y;
                    }
                }

                out.push(new RenderCommand(RENDER_CMD.DRAW_ELLIPSE, this.style, data));

                break;
            }
        }
    }

    #drawTip(
        tip: Tip | null,
        origin: IVector<number>,
        angMult: number,
        out: RenderCommandStream,
        extraData: Partial<DrawDataLine>,
    ) {
        if (!this.#start || !this.#end) {
            return;
        }

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
                    ...extraData,
                    x1: origin.x,
                    y1: origin.y,
                    x2: origin.x + Math.cos(baseAng + (angle / 180) * Math.PI) * length,
                    y2: origin.y + -Math.sin(baseAng + (angle / 180) * Math.PI) * length,
                }),
            );
            out.push(
                new RenderCommand(RENDER_CMD.DRAW_LINE, tipStyle, {
                    ...extraData,
                    x1: origin.x,
                    y1: origin.y,
                    x2: origin.x + -Math.cos(baseAng + (-angle / 180) * Math.PI) * length,
                    y2: origin.y + Math.sin(baseAng + (-angle / 180) * Math.PI) * length,
                }),
            );
        }
    }
}
