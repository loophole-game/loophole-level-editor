import { RENDER_CMD, RenderCommand, type RenderCommandStream, type RenderStyle } from '../renderer';
import { DrawableComponent } from './index';

type Shape = 'RECT' | 'ELLIPSE';

export class ShapeComponent extends DrawableComponent {
    protected override readonly _typeString: string = 'ShapeComponent';

    #shape: Shape;

    constructor(name: string, shape: Shape, style?: RenderStyle) {
        super(name, style);

        this.#shape = shape;
    }

    override queueRenderCommands(out: RenderCommandStream): void {
        if (!this.entity?.transform) {
            return;
        }

        const transform = this.entity.transform;

        // Push the transform, draw at origin with unit size, let the transform handle everything
        if (transform && !transform.isIdentity) {
            out.push(new RenderCommand(RENDER_CMD.PUSH_TRANSFORM, null, { t: transform }));
        }

        switch (this.#shape) {
            case 'RECT':
                out.push(
                    new RenderCommand(RENDER_CMD.DRAW_RECT, this.style, {
                        x: 0,
                        y: 0,
                        w: 1,
                        h: 1,
                        fill: Boolean(this._style.fillStyle),
                        stroke: Boolean(this._style.strokeStyle),
                    }),
                );
                break;
            case 'ELLIPSE':
                out.push(
                    new RenderCommand(RENDER_CMD.DRAW_ELLIPSE, this.style, {
                        x: 0,
                        y: 0,
                        w: 1,
                        h: 1,
                        fill: Boolean(this._style.fillStyle),
                        stroke: Boolean(this._style.strokeStyle),
                    }),
                );
                break;
        }

        if (transform && !transform.isIdentity) {
            out.push(new RenderCommand(RENDER_CMD.POP_TRANSFORM, null));
        }
    }
}
