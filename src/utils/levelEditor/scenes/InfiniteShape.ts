import { Entity, type EntityOptions } from '../../engine/entities';
import { C_Shape, type C_ShapeOptions } from '../../engine/components/Shape';
import { zoomToScale } from '../../engine/utils';
import { Vector, type VectorConstructor } from '@/utils/engine/math';
import type { Engine } from '@/utils/engine';

export interface E_InfiniteShapeOptions<TEngine extends Engine = Engine>
    extends EntityOptions<TEngine> {
    shapeOptions: Omit<C_ShapeOptions<TEngine>, 'engine'>;
    tileSize: VectorConstructor;
    zoomCullThresh?: number;
    offset?: VectorConstructor;
}

export class E_InfiniteShape<TEngine extends Engine = Engine> extends Entity<TEngine> {
    #shape: C_Shape;
    #offset: Vector;
    #tileSize: Vector;
    #zoomCullThresh: number | null;

    constructor(options: E_InfiniteShapeOptions<TEngine>) {
        const { name = 'infinite_shape', ...rest } = options;
        super({ name, ...rest });

        this.#shape = this.addComponents(C_Shape<TEngine>, options.shapeOptions);
        this.#tileSize = new Vector(options.tileSize);
        this.#offset = new Vector(options.offset ?? 0);
        this.#zoomCullThresh = options.zoomCullThresh ?? null;
    }

    override update(deltaTime: number) {
        const updated = super.update(deltaTime);

        if (window.engine?.canvasSize) {
            const scale = zoomToScale(window.engine.camera.zoom);
            if (this.#zoomCullThresh === null || scale >= this.#zoomCullThresh) {
                const topLeft = window.engine.screenToWorld({ x: 0, y: 0 }),
                    bottomRight = window.engine.screenToWorld(window.engine.canvasSize);
                const gridTopLeft = {
                        x: Math.floor((topLeft.x - this.#tileSize.x / 2) / this.#tileSize.x),
                        y: Math.floor((topLeft.y - this.#tileSize.y / 2) / this.#tileSize.y),
                    },
                    gridBottomRight = {
                        x: Math.floor((bottomRight.x + this.#tileSize.x / 2) / this.#tileSize.x),
                        y: Math.floor((bottomRight.y + this.#tileSize.y / 2) / this.#tileSize.y),
                    };

                this.setPosition({
                    x: gridTopLeft.x * this.#tileSize.x + this.#tileSize.x / 2 + this.#offset.x,
                    y: gridTopLeft.y * this.#tileSize.y + this.#tileSize.y / 2 + this.#offset.y,
                });

                this.#shape.repeat = {
                    x: Math.abs(gridTopLeft.x - gridBottomRight.x) + 1,
                    y: Math.abs(gridTopLeft.y - gridBottomRight.y) + 1,
                };
                this.#shape.setEnabled(true);
            } else {
                this.#shape.setEnabled(false);
            }
        }

        return updated;
    }
}
