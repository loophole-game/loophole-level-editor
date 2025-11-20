import {
    RENDER_CMD,
    RenderCommand,
    type DrawDataShape,
    type RenderCommandStream,
} from '../systems/render';
import type { Position } from '../types';
import { vectorOrNumberToVector } from '../utils';
import { C_Drawable, type C_DrawableOptions } from './index';

export type Shape = 'RECT' | 'ELLIPSE';

export interface C_ShapeOptions extends C_DrawableOptions {
    shape: Shape;
    repeat?: number | Position;
    gap?: number | Position;
}

export class C_Shape extends C_Drawable {
    #shape: Shape;
    #repeat: Position | null;
    #gap: Position | null;

    constructor(options: C_ShapeOptions) {
        const {
            shape,
            repeat,
            gap,
            origin = shape === 'ELLIPSE' ? { x: 0, y: 0 } : { x: 0.5, y: 0.5 },
            scale = { x: 1, y: 1 },
            ...rest
        } = options;
        super({
            ...rest,
            origin,
            scale,
        });

        this.#shape = shape;
        if (repeat !== undefined) {
            this.#repeat = vectorOrNumberToVector(repeat);
        } else {
            this.#repeat = null;
        }
        if (gap !== undefined) {
            this.#gap = vectorOrNumberToVector(gap);
        } else {
            this.#gap = null;
        }
    }

    get shape(): Shape {
        return this.#shape;
    }

    set shape(shape: Shape) {
        this.#shape = shape;
        this.setOrigin(shape === 'ELLIPSE' ? { x: 0, y: 0 } : { x: 0.5, y: 0.5 });
    }

    get repeat(): Position | null {
        return this.#repeat;
    }

    set repeat(repeat: Position | null) {
        this.#repeat = repeat;
    }

    get gap(): Position | null {
        return this.#gap;
    }

    set gap(gap: Position | null) {
        this.#gap = gap;
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
