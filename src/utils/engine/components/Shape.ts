import {
    RENDER_CMD,
    RenderCommand,
    type DrawDataShape,
    type RenderCommandStream,
} from '../systems/render';
import { Vector, type VectorConstructor } from '../math';
import { C_Drawable, type C_DrawableOptions } from './index';

export type Shape = 'RECT' | 'ELLIPSE';

export interface C_ShapeOptions extends C_DrawableOptions {
    shape: Shape;
    repeat?: VectorConstructor;
    gap?: VectorConstructor;
}

export class C_Shape extends C_Drawable {
    #shape: Shape;
    #repeat: Vector | null;
    #gap: Vector | null;

    constructor(options: C_ShapeOptions) {
        const {
            shape,
            repeat,
            gap,
            origin = shape === 'ELLIPSE' ? new Vector(0, 0) : new Vector(0.5, 0.5),
            scale = new Vector(1, 1),
            ...rest
        } = options;
        super({
            ...rest,
            origin,
            scale,
        });

        this.#shape = shape;
        this.#repeat = repeat !== undefined ? new Vector(repeat) : null;
        this.#gap = gap !== undefined ? new Vector(gap) : null;
    }

    get shape(): Shape {
        return this.#shape;
    }

    set shape(shape: Shape) {
        this.#shape = shape;
        this.setOrigin(shape === 'ELLIPSE' ? new Vector(0, 0) : new Vector(0.5, 0.5));
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

    override queueRenderCommands(out: RenderCommandStream): void {
        if (!this.entity?.transform) {
            return;
        }

        switch (this.#shape) {
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
}
