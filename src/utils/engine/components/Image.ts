import { C_Drawable } from '.';
import {
    RENDER_CMD,
    RenderCommand,
    type DrawDataImage,
    type RenderCommandStream,
    type RenderStyle,
} from '../systems/render';
import type { Position } from '../types';

export class C_Image extends C_Drawable {
    #imageName: string;
    #repeat: Position | null;

    constructor(name: string, imageName: string, style?: RenderStyle, repeat?: Position) {
        super(name, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }, style);

        this.#imageName = imageName;
        this.#repeat = repeat ?? null;
    }

    get imageName(): string {
        return this.#imageName;
    }

    set imageName(imageName: string) {
        this.#imageName = imageName;
    }

    get repeat(): Position | null {
        return this.#repeat;
    }

    set repeat(repeat: Position | null) {
        this.#repeat = repeat;
    }

    override queueRenderCommands(out: RenderCommandStream): void {
        if (!this._entity || !this.#imageName) {
            return;
        }

        const data: DrawDataImage = {
            x: -0.5 * this.scale.x,
            y: -0.5 * this.scale.y,
            w: this.scale.x,
            h: this.scale.y,
            img: this.#imageName,
        };
        if (this.#repeat) {
            data.rx = this.#repeat.x;
            data.ry = this.#repeat.y;
        }

        out.push(new RenderCommand(RENDER_CMD.DRAW_IMAGE, this.style, data));
    }
}
