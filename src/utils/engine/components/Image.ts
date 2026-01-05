import { C_Drawable, type C_DrawableOptions } from '.';
import { Vector, type VectorConstructor } from '../math';
import type { RenderCommandStream } from '../systems/render/command';

interface C_ImageOptions extends C_DrawableOptions {
    imageName: string;
    repeat?: VectorConstructor;
}

export class C_Image extends C_Drawable {
    #imageName: string;
    #repeat: Vector;

    constructor(options: C_ImageOptions) {
        super(options);

        const { imageName, repeat } = options;
        this.#imageName = imageName;
        this.#repeat = new Vector(repeat ?? 1);
    }

    get imageName(): string {
        return this.#imageName;
    }

    set imageName(imageName: string) {
        this.#imageName = imageName;
    }

    get repeat(): Vector {
        return this.#repeat;
    }

    set repeat(repeat: VectorConstructor | null) {
        this.#repeat = new Vector(repeat ?? 1);
    }

    override queueRenderCommands(stream: RenderCommandStream): boolean {
        if (!this._entity || !this.#imageName || !super.queueRenderCommands(stream)) {
            return false;
        }

        stream.drawImage(
            -this.origin.x * this.scale.x,
            -this.origin.y * this.scale.y,
            this.scale.x,
            this.scale.y,
            this.#imageName,
            this.#repeat.x,
            this.#repeat.y,
            1,
            1,
        );

        return true;
    }
}
