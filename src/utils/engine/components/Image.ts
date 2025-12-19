import { C_Drawable, type C_DrawableOptions } from '.';
import type { Engine } from '..';
import { Vector, type VectorConstructor } from '../math';
import type { RenderCommandStream } from '../systems/render/command';

interface C_ImageOptions<TEngine extends Engine = Engine> extends C_DrawableOptions<TEngine> {
    imageName: string;
    repeat?: VectorConstructor;
}

export class C_Image<TEngine extends Engine = Engine> extends C_Drawable<TEngine> {
    #imageName: string;
    #repeat: Vector | null;

    constructor(options: C_ImageOptions<TEngine>) {
        super(options);

        const { imageName, repeat } = options;
        this.#imageName = imageName;
        this.#repeat = repeat ? new Vector(repeat) : null;
    }

    get imageName(): string {
        return this.#imageName;
    }

    set imageName(imageName: string) {
        this.#imageName = imageName;
    }

    get repeat(): Vector | null {
        return this.#repeat;
    }

    set repeat(repeat: VectorConstructor | null) {
        this.#repeat = repeat ? new Vector(repeat) : null;
    }

    override queueRenderCommands(stream: RenderCommandStream): void {
        if (!this._entity || !this.#imageName) {
            return;
        }

        super.queueRenderCommands(stream);

        stream.drawImage(
            -this.origin.x * this.scale.x,
            -this.origin.y * this.scale.y,
            this.scale.x,
            this.scale.y,
            this.#imageName,
            this.#repeat?.x,
            this.#repeat?.y,
        );
    }
}
