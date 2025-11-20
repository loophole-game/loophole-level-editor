import { C_Drawable, type C_DrawableOptions } from '.';
import {
    RENDER_CMD,
    RenderCommand,
    type DrawDataImage,
    type RenderCommandStream,
} from '../systems/render';
import type { Position } from '../types';

interface C_ImageOptions extends C_DrawableOptions {
    imageName: string;
    repeat?: Position;
}

export class C_Image extends C_Drawable {
    #imageName: string;
    #repeat: Position | null;

    constructor(options: C_ImageOptions) {
        super(options);

        const { imageName, repeat } = options;
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
            x: -this.origin.x * this.scale.x,
            y: -this.origin.y * this.scale.y,
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
