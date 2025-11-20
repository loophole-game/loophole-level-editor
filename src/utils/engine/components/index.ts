import type { Entity } from '../entities';
import type { Camera, Position, Renderable } from '../types';
import type { RenderCommandStream, RenderStyle } from '../systems/render';
import { vectorOrNumberToVector } from '../utils';

export interface ComponentOptions {
    name: string;
    enabled?: boolean;
    zIndex?: number;
}

export abstract class Component implements Renderable {
    protected static _nextId: number = 1;
    protected readonly _id: number = Component._nextId++;
    protected readonly _name: string;

    protected _enabled: boolean = true;

    protected _zIndex: number = 0;

    protected _entity: Entity | null = null;

    constructor(options: string | ComponentOptions) {
        const { name = `component-${this._id}`, ...rest } = (
            typeof options === 'string' ? { name: options } : (options ?? {})
        ) as ComponentOptions;

        this._name = name;
        this._enabled = rest?.enabled ?? true;
        this._zIndex = rest?.zIndex ?? 0;
    }

    get id(): number {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    get typeString(): string {
        return this.constructor.name;
    }

    get entity(): Entity | null {
        return this._entity;
    }

    set entity(entity: Entity | null) {
        this._entity = entity;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    destroy(): void {
        this._entity = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueRenderCommands(_out: RenderCommandStream, _camera: Camera): void {}

    setZIndex(zIndex: number): this {
        if (this._zIndex !== zIndex && !isNaN(zIndex)) {
            this._zIndex = zIndex;
            if (this._entity) {
                this._entity.componentsZIndexDirty = true;
            }
        }

        return this;
    }

    setEnabled(enabled: boolean): this {
        this._enabled = enabled;

        return this;
    }
}

export interface C_DrawableOptions extends ComponentOptions {
    origin?: number | Position;
    scale?: number | Position;
    style?: RenderStyle;
}

export abstract class C_Drawable extends Component {
    protected _origin: Position;
    protected _scale: Position;
    protected _style: RenderStyle;

    constructor(options: string | C_DrawableOptions) {
        const optionsObj = (
            typeof options === 'string' ? { name: options } : (options ?? {})
        ) as C_DrawableOptions;
        super(optionsObj);

        this._origin = vectorOrNumberToVector(optionsObj.origin ?? 0.5);
        this._scale = vectorOrNumberToVector(optionsObj.scale ?? 1);
        this._style = optionsObj.style ?? {};
    }

    get style(): RenderStyle {
        return this._style;
    }

    set style(style: RenderStyle) {
        this._style = { ...this._style, ...style };
    }

    get origin(): Readonly<Position> {
        return this._origin;
    }

    setOrigin(origin: number | Position): this {
        this._origin = vectorOrNumberToVector(origin);
        return this;
    }

    get scale(): Readonly<Position> {
        return this._scale;
    }

    setScale(scale: number | Position): this {
        this._scale = vectorOrNumberToVector(scale);
        return this;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueRenderCommands(_out: RenderCommandStream): void {}
}
