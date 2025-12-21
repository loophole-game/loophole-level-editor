import { Vector, type IVector, type VectorConstructor } from '../math';
import { C_Drawable, type C_DrawableOptions } from './index';
import type { Engine } from '..';
import type { RenderCommandStream } from '../systems/render/command';

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
    #repeat: Vector;
    #gap: Vector;

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
        this.#repeat = new Vector(repeat ?? 1);
        this.#gap = new Vector(gap ?? 1);

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
            this.setOrigin(0);
        } else if (shape === 'RECT') {
            this.setOrigin(0.5);
        }
    }

    get repeat(): Vector {
        return this.#repeat;
    }

    set repeat(repeat: VectorConstructor | null) {
        this.#repeat = new Vector(repeat ?? 1);
    }

    get gap(): Vector {
        return this.#gap;
    }

    set gap(gap: VectorConstructor | null) {
        this.#gap = new Vector(gap ?? 1);
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

    override queueRenderCommands(stream: RenderCommandStream): void {
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

                super.queueRenderCommands(stream);

                stream.drawLine(
                    this.#start.x,
                    this.#start.y,
                    this.#end.x,
                    this.#end.y,
                    this.#repeat.x,
                    this.#repeat.y,
                    this.#gap.x,
                    this.#gap.y,
                );

                this.#drawTip(this.#startTip, this.#start, -1, stream);
                this.#drawTip(this.#endTip, this.#end, 1, stream);

                break;
            }
            case 'RECT': {
                super.queueRenderCommands(stream);

                stream.drawRect(
                    (-1 - (this._scale.x - 1)) * this._origin.x,
                    (-1 - (this._scale.y - 1)) * this._origin.y,
                    this._scale.x,
                    this._scale.y,
                    this.#repeat?.x,
                    this.#repeat?.y,
                    this.#gap?.x,
                    this.#gap?.y,
                );

                break;
            }
            case 'ELLIPSE': {
                super.queueRenderCommands(stream);
                stream.drawEllipse(
                    (-1 - (this._scale.x - 1)) * this._origin.x,
                    (-1 - (this._scale.y - 1)) * this._origin.y,
                    this._scale.x,
                    this._scale.y,
                    this.#repeat?.x,
                    this.#repeat?.y,
                    this.#gap?.x,
                    this.#gap?.y,
                );

                break;
            }
        }
    }

    #drawTip(
        tip: Tip | null,
        origin: IVector<number>,
        angMult: number,
        stream: RenderCommandStream,
    ) {
        if (!this.#start || !this.#end) {
            return;
        }

        if (tip?.type === 'arrow') {
            const { length = DEFAULT_ARROW_LENGTH } = tip;
            let { angle = DEFAULT_ARROW_ANGLE } = tip;
            angle *= angMult;
            const baseAng = Math.atan2(this.#end.x - this.#start.x, this.#end.y - this.#start.y);

            stream.setStyle({
                ...this.style,
                lineCap: 'round',
                lineJoin: 'round',
            });

            stream.drawLine(
                origin.x,
                origin.y,
                origin.x + Math.cos(baseAng + (angle / 180) * Math.PI) * length,
                origin.y + -Math.sin(baseAng + (angle / 180) * Math.PI) * length,
                this.#repeat?.x,
                this.#repeat?.y,
                this.#gap?.x,
                this.#gap?.y,
            );
            stream.drawLine(
                origin.x,
                origin.y,
                origin.x + -Math.cos(baseAng + (-angle / 180) * Math.PI) * length,
                origin.y + Math.sin(baseAng + (-angle / 180) * Math.PI) * length,
                this.#repeat?.x,
                this.#repeat?.y,
                this.#gap?.x,
                this.#gap?.y,
            );
        }
    }
}
