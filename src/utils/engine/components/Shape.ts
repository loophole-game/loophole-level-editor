import {
    RENDER_CMD,
    RenderCommand,
    type DrawDataShape,
    type RenderCommandStream,
    type RenderStyle,
} from '../systems/render';
import type { Position } from '../types';
import { DrawableComponent } from './index';

type Shape = 'RECT' | 'ELLIPSE';

export class C_Shape extends DrawableComponent {
    #shape: Shape;
    #repeat: Position | null;

    constructor(name: string, shape: Shape, style?: RenderStyle, repeat?: Position) {
        super(name, style);

        this.#shape = shape;
        this.#repeat = repeat ?? null;
    }

    get repeat(): Position | null {
        return this.#repeat;
    }

    set repeat(repeat: Position | null) {
        this.#repeat = repeat;
    }

    override queueRenderCommands(out: RenderCommandStream): void {
        if (!this.entity?.transform) {
            return;
        }

        switch (this.#shape) {
            case 'RECT': {
                const data: DrawDataShape = {
                    x: this.entity.transform.position.x - this.entity.transform.scale.x / 2,
                    y: this.entity.transform.position.y - this.entity.transform.scale.y / 2,
                    w: this.entity.transform.scale.x,
                    h: this.entity.transform.scale.y,
                };
                if (this.#repeat) {
                    data.rx = this.#repeat.x;
                    data.ry = this.#repeat.y;
                }

                out.push(new RenderCommand(RENDER_CMD.DRAW_RECT, this.style, data));

                break;
            }
            case 'ELLIPSE': {
                const data: DrawDataShape = {
                    x: this.entity.transform.position.x,
                    y: this.entity.transform.position.y,
                    w: this.entity.transform.scale.x,
                    h: this.entity.transform.scale.y,
                };
                if (this.#repeat) {
                    data.rx = this.#repeat.x;
                    data.ry = this.#repeat.y;
                }

                out.push(new RenderCommand(RENDER_CMD.DRAW_ELLIPSE, this.style, data));

                break;
            }
        }
    }
}
