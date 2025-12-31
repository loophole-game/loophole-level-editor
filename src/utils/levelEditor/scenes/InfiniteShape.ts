import { Entity, type EntityOptions } from '../../engine/entities';
import { C_Shape, type C_ShapeOptions } from '../../engine/components/Shape';
import { zoomToScale } from '../../engine/utils';
import { Vector, type IVector, type VectorConstructor } from '@/utils/engine/math';
import type { Engine } from '@/utils/engine';

export interface E_InfiniteShapeOptions<TEngine extends Engine = Engine>
    extends EntityOptions<TEngine> {
    shapeOptions: Omit<C_ShapeOptions<TEngine>, 'engine'>;
    tileSize: VectorConstructor;
    zoomCullThresh?: number;
    offset?: VectorConstructor;
    infiniteAxes?: Partial<IVector<boolean>>;
}

export class E_InfiniteShape<TEngine extends Engine = Engine> extends Entity<TEngine> {
    #shape: C_Shape;
    #offset: Vector;
    #tileSize: Vector;
    #zoomCullThresh: number | null;
    #infiniteAxes: IVector<boolean>;
    #position: Vector | null = null;

    constructor(options: E_InfiniteShapeOptions<TEngine>) {
        const { name = 'infinite_shape', ...rest } = options;
        super({ name, cull: 'none', ...rest });

        this.#shape = this.addComponents(C_Shape<TEngine>, options.shapeOptions);
        if (!options.shapeOptions.gap) {
            this.#shape.gap = new Vector(options.tileSize).div(this.scale);
        }
        this.#tileSize = new Vector(options.tileSize);
        this.#offset = new Vector(options.offset ?? 0);
        this.#zoomCullThresh = options.zoomCullThresh ?? null;
        this.#infiniteAxes = {
            x: options.infiniteAxes?.x ?? true,
            y: options.infiniteAxes?.y ?? true,
        };
    }

    get shape(): C_Shape {
        return this.#shape;
    }

    get offset(): Vector {
        return this.#offset;
    }

    set offset(offset: VectorConstructor) {
        this.#offset.set(offset);
    }

    get tileSize(): Vector {
        return this.#tileSize;
    }

    set tileSize(tileSize: VectorConstructor) {
        this.#tileSize.set(tileSize);
    }

    get zoomCullThresh(): number | null {
        return this.#zoomCullThresh;
    }

    set zoomCullThresh(zoomCullThresh: number) {
        this.#zoomCullThresh = zoomCullThresh;
    }

    get infiniteAxes(): IVector<boolean> {
        return this.#infiniteAxes;
    }

    set infiniteAxes(infiniteAxes: Partial<IVector<boolean>>) {
        this.#infiniteAxes.x = infiniteAxes.x ?? this.#infiniteAxes.x;
        this.#infiniteAxes.y = infiniteAxes.y ?? this.#infiniteAxes.y;
    }

    override update(deltaTime: number) {
        const updated = super.update(deltaTime);

        this.sync();

        return updated;
    }

    override setPosition(position: VectorConstructor): this {
        this.#position = position ? new Vector(position) : null;

        return this;
    }

    sync() {
        if (this._engine.canvasSize) {
            const scale = zoomToScale(this._engine.camera.zoom);
            if (this.#zoomCullThresh === null || scale >= this.#zoomCullThresh) {
                const corners = [
                    this._engine.screenToWorld({ x: 0, y: 0 }),
                    this._engine.screenToWorld({ x: this._engine.canvasSize.x, y: 0 }),
                    this._engine.screenToWorld({ x: 0, y: this._engine.canvasSize.y }),
                    this._engine.screenToWorld(this._engine.canvasSize),
                ];

                const minX = Math.min(...corners.map((c) => c.x));
                const maxX = Math.max(...corners.map((c) => c.x));
                const minY = Math.min(...corners.map((c) => c.y));
                const maxY = Math.max(...corners.map((c) => c.y));

                const gridTopLeft = {
                        x: Math.floor((minX - this.#tileSize.x / 2) / this.#tileSize.x),
                        y: Math.floor((minY - this.#tileSize.y / 2) / this.#tileSize.y),
                    },
                    gridBottomRight = {
                        x: Math.floor((maxX + this.#tileSize.x / 2) / this.#tileSize.x),
                        y: Math.floor((maxY + this.#tileSize.y / 2) / this.#tileSize.y),
                    };

                super.setPosition({
                    x: this.#infiniteAxes.x
                        ? gridTopLeft.x * this.#tileSize.x + this.#tileSize.x / 2 + this.#offset.x
                        : this.#position
                          ? this.#position.x
                          : 0,
                    y: this.#infiniteAxes.y
                        ? gridTopLeft.y * this.#tileSize.y + this.#tileSize.y / 2 + this.#offset.y
                        : this.#position
                          ? this.#position.y
                          : 0,
                });

                this.#shape.repeat = {
                    x: this.#infiniteAxes.x ? Math.abs(gridTopLeft.x - gridBottomRight.x) + 1 : 1,
                    y: this.#infiniteAxes.y ? Math.abs(gridTopLeft.y - gridBottomRight.y) + 1 : 1,
                };
                this.#shape.setEnabled(true);
            } else {
                this.#shape.setEnabled(false);
            }
        }
    }
}
