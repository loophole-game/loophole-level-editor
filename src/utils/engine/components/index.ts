import type { Entity } from '../entities';
import type { BoundingBox, Camera, Renderable } from '../types';
import { Vector, type VectorConstructor } from '../math';
import type { RenderCommandStream } from '../systems/render/command';
import type { RenderStyle } from '../systems/render/style';

import type { Engine } from '..';
import { OPACITY_THRESHOLD } from '../utils';

export interface ComponentOptions {
    name?: string;
    enabled?: boolean;
    zIndex?: number;
}

interface InternalComponentOptions<TEngine extends Engine = Engine> extends ComponentOptions {
    engine: TEngine;
    entity: Entity;
}

export abstract class Component<TEngine extends Engine = Engine> implements Renderable {
    protected static _nextId: number = 1;
    protected readonly _id: string = (Component._nextId++).toString();

    protected readonly _name: string;
    protected _engine: TEngine;

    protected _enabled: boolean;
    protected _zIndex: number;

    protected _entity: Entity<TEngine>;

    protected _boundingBox: BoundingBox | null = null;
    protected _boundingBoxDirty: boolean = true;

    constructor(options: ComponentOptions) {
        const {
            name = `component-${this._id}`,
            engine,
            entity,
            ...rest
        } = options as InternalComponentOptions<TEngine>;
        this._name = name;
        this._engine = engine;
        this._entity = entity as Entity<TEngine>;
        this._enabled = rest?.enabled ?? true;
        this._zIndex = rest?.zIndex ?? 0;
    }

    get id(): string {
        return this._id;
    }

    get typeString(): string {
        return this.constructor.name;
    }

    get name(): string {
        return this._name;
    }

    get engine(): TEngine {
        return this._engine;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    get entity(): Entity<TEngine> {
        return this._entity;
    }

    get boundingBox(): Readonly<BoundingBox> {
        if (this._boundingBoxDirty) {
            this._computeBoundingBox();
            this._boundingBoxDirty = false;
        }

        return this._boundingBox!;
    }

    protected _markBoundingBoxDirty(): void {
        if (!this._boundingBoxDirty) {
            this._boundingBoxDirty = true;
            if (this._entity) {
                this._entity.transform.markBoundingBoxDirty();
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    destroy(): void {
        this._entity?.onChildComponentsOfTypeChanged(this.typeString);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueRenderCommands(_stream: RenderCommandStream, _camera: Camera): boolean {
        return false;
    }

    setZIndex(zIndex: number): this {
        if (this._zIndex !== zIndex && !isNaN(zIndex)) {
            this._zIndex = zIndex;
            if (this._entity) {
                this._entity.componentsZIndexDirty = true;
                this._entity.onChildComponentsOfTypeChanged(this.typeString);
            }
        }

        return this;
    }

    setEnabled(enabled: boolean): this {
        if (this._enabled !== enabled) {
            this._enabled = enabled;
            this._entity?.onChildComponentsOfTypeChanged(this.typeString);
        }

        return this;
    }

    protected _computeBoundingBox(): void {
        this._boundingBox = { x1: 0, x2: 0, y1: 0, y2: 0 };
    }
}

export interface C_DrawableOptions extends ComponentOptions {
    origin?: VectorConstructor;
    scale?: VectorConstructor;
    style?: RenderStyle;
    opacity?: number;
}

export abstract class C_Drawable extends Component {
    protected _origin: Vector;
    protected _scale: Vector;
    protected _style: RenderStyle;
    protected _opacity: number;

    constructor(options: C_DrawableOptions) {
        const { name = 'drawable', ...rest } = options;
        super({ name, ...rest });

        this._origin = new Vector(options.origin ?? 0.5);
        this._scale = new Vector(options.scale ?? 1);
        this._style = options.style ?? {};
        this._opacity = rest?.opacity ?? 1;
    }

    get style(): RenderStyle {
        return this._style;
    }

    setStyle(style: RenderStyle): this {
        this._style = { ...this._style, ...style };
        return this;
    }

    get origin(): Readonly<Vector> {
        return this._origin;
    }

    setOrigin(origin: VectorConstructor): this {
        if (this._origin.set(origin)) {
            this._markBoundingBoxDirty();
        }

        return this;
    }

    get scale(): Readonly<Vector> {
        return this._scale;
    }

    setScale(scale: VectorConstructor): this {
        if (this._scale.set(scale)) {
            this._markBoundingBoxDirty();
        }

        return this;
    }

    get opacity(): number {
        return this._opacity;
    }

    setOpacity(opacity: number): this {
        if (this._opacity !== opacity) {
            this._opacity = opacity;
            if (this._entity) {
                this._entity.onChildComponentsOfTypeChanged(this.typeString);
            }
        }

        return this;
    }

    public override queueRenderCommands(stream: RenderCommandStream): boolean {
        if (this._opacity >= OPACITY_THRESHOLD) {
            stream.setOpacity(this._opacity);
            stream.setStyle(this._style);

            return true;
        }

        return false;
    }

    protected override _computeBoundingBox(): void {
        this._boundingBox = {
            x1: -this._origin.x * this._scale.x,
            x2: this._origin.x * this._scale.x,
            y1: -this._origin.y * this._scale.y,
            y2: this._origin.y * this._scale.y,
        };
    }
}
