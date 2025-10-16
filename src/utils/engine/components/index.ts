import { v4 } from 'uuid';
import type { Entity } from '../entities';
import type { RenderCommandStream, RenderStyle } from '../renderer';
import type { Renderable } from '../types';

export abstract class Component implements Renderable {
    protected readonly _id: string;
    protected readonly _name: string;
    protected readonly _typeString: string = 'Component';
    protected _enabled: boolean = true;

    protected _entity: Entity | null = null;

    constructor(name: string) {
        this._name = name;
        this._id = v4();
    }

    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(enabled: boolean) {
        this._enabled = enabled;
    }

    get typeString(): string {
        return this._typeString;
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

    abstract queueRenderCommands(out: RenderCommandStream): void;
}

export abstract class DrawableComponent extends Component {
    protected _style: RenderStyle;
    protected override readonly _typeString: string = 'DrawableComponent';

    constructor(name: string, style?: RenderStyle) {
        super(name);

        this._style = style ?? {};
    }

    get style(): RenderStyle {
        return this._style;
    }

    set style(style: RenderStyle) {
        this._style = { ...this._style, ...style };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queueRenderCommands(_out: RenderCommandStream): void {}
}
