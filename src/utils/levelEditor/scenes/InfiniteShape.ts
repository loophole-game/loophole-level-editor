import { Entity, type EntityOptions } from '../../engine/entities';
import { C_Shape } from '../../engine/components/Shape';
import type { Position } from '../../engine/types';
import { vectorOrNumberToVector, zoomToScale } from '../../engine/utils';

interface E_InfiniteShapeOptions extends EntityOptions {
    shape: C_Shape;
    tileSize: number | Position;
    zoomCullThresh?: number;
    offset?: number | Position;
}

export class E_InfiniteShape extends Entity {
    #shape: C_Shape;
    #offset: Position;
    #tileSize: Position;
    #zoomCullThresh: number | null;

    constructor(options: E_InfiniteShapeOptions) {
        super(options);

        this.#shape = options.shape;
        this.#tileSize = vectorOrNumberToVector(options.tileSize);
        this.#offset =
            options.offset !== undefined ? vectorOrNumberToVector(options.offset) : { x: 0, y: 0 };
        this.#zoomCullThresh = options.zoomCullThresh ?? null;

        this.addComponents(this.#shape);
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
