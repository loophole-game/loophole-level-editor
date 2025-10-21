import type { Entity } from '../entities';
import type { Position, Renderable } from '../types';
import type { RenderCommandStream, RenderStyle } from '../systems/render';

export abstract class Component implements Renderable {
    protected static _nextId: number = 1;
    protected readonly _id: number = Component._nextId++;
    protected readonly _name: string;

    protected _enabled: boolean = true;

    protected _zIndex: number = 0;

    protected _entity: Entity | null = null;

    constructor(name: string) {
        this._name = name;
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

    set enabled(enabled: boolean) {
        this._enabled = enabled;
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
    update(_: number): boolean {
        return false;
    }

    destroy(): void {
        this._entity = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueRenderCommands(_out: RenderCommandStream) {}

    setZIndex(zIndex: number): this {
        this._zIndex = zIndex;
        if (this._entity) {
            this._entity.componentsZIndexDirty = true;
        }

        return this;
    }

    setEnabled(enabled: boolean): this {
        this._enabled = enabled;
        return this;
    }
}

export abstract class C_Drawable extends Component {
    protected _origin: Position;
    protected _scale: Position;
    protected _style: RenderStyle;

    constructor(name: string, origin: Position, scale: Position, style?: RenderStyle) {
        super(name);

        this._origin = origin;
        this._scale = scale;
        this._style = style ?? {};
    }

    get style(): RenderStyle {
        return this._style;
    }

    set style(style: RenderStyle) {
        this._style = { ...this._style, ...style };
    }

    get origin(): Position {
        return this._origin;
    }

    setOrigin(origin: Position): this {
        this._origin = origin;
        return this;
    }

    get scale(): Position {
        return this._scale;
    }

    setScale(scale: Position): this {
        this._scale = scale;
        return this;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueRenderCommands(_out: RenderCommandStream): void {}
}
