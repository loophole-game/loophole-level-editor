import type { Component } from '../components';
import { RENDER_CMD, RenderCommand, type RenderCommandStream } from '../systems/render';
import type { Position, RecursiveArray, Renderable } from '../types';
import { C_Transform } from '../components/transforms';

export class Entity implements Renderable {
    protected static _nextId: number = 1;
    protected readonly _id: number = Entity._nextId++;
    protected readonly _name: string;

    protected _enabled: boolean = true;
    protected _updated: boolean = false;

    protected _zIndex: number = 0;

    protected _parent: Entity | null = null;
    protected _transform: C_Transform;

    protected _children: Entity[] = [];
    #childrenZIndexDirty: boolean = false;

    protected _components: Component[];
    #componentsZIndexDirty: boolean = false;

    constructor(name: string, ...components: Component[]) {
        this._name = name;
        this._components = [...components];
        this._components.push((this._transform = new C_Transform()));
        this._components.forEach((component) => {
            component.entity = this;
        });
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

    get transform(): C_Transform {
        return this._transform;
    }

    get position(): Readonly<Position> {
        return this._transform.position;
    }

    get worldPosition(): Readonly<Position> {
        return this._transform.worldPosition;
    }

    get scale(): Readonly<Position> {
        return this._transform.scale;
    }

    get rotation(): number {
        return this._transform.rotation;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    set componentsZIndexDirty(dirty: boolean) {
        this.#componentsZIndexDirty = dirty;
    }

    set childrenZIndexDirty(dirty: boolean) {
        this.#childrenZIndexDirty = dirty;
    }

    get components(): ReadonlyArray<Component> {
        return this._components;
    }

    get parent(): Readonly<Entity> | null {
        return this._parent;
    }

    set parent(parent: Entity | null) {
        this._parent = parent;
    }

    get children(): ReadonlyArray<Entity> {
        return this._children;
    }

    getComponentsInTree<T extends Component>(typeString: string): T[] {
        return this.#getComponentsInTree<T>(typeString).flat() as T[];
    }

    update(deltaTime: number): boolean {
        let updated = this._updated;
        this._updated = false;

        for (const component of this._components) {
            if (component.enabled) {
                updated = component.update(deltaTime) || updated;
            }
        }

        for (const child of this._children) {
            if (child.enabled) {
                updated = child.update(deltaTime) || updated;
            }
        }

        return updated;
    }

    destroy(): void {
        this._parent?.removeChild(this);
        this.#destroy();
    }

    addChildren(...entities: Entity[]): this {
        for (const entity of entities) {
            this._children.push(entity);
            entity.parent = this;
        }
        this.childrenZIndexDirty = true;

        return this;
    }

    removeChild(entity: Entity): void {
        this._children = [...this._children.filter((e) => e !== entity)];
        entity.parent = null;
    }

    setEnabled(enabled: boolean): this {
        this._enabled = enabled;

        return this;
    }

    setPosition(newPosition: Position): this {
        this._transform.setPosition(newPosition);

        return this;
    }

    setScale(newScale: Position): this {
        this._transform.setScale(newScale);

        return this;
    }

    setRotation(newRotation: number): this {
        this._transform.setRotation(newRotation);

        return this;
    }

    translate(delta: Position): this {
        this._transform.translate(delta);

        return this;
    }

    scaleBy(delta: Position): this {
        this._transform.scaleBy(delta);

        return this;
    }

    rotate(delta: number): this {
        this._transform.rotate(delta);

        return this;
    }

    setZIndex(zIndex: number): this {
        if (this._zIndex !== zIndex) {
            this._zIndex = zIndex;
            if (zIndex === 0) console.trace('setZIndex', this.name, zIndex);
            if (this._parent) {
                this._parent.childrenZIndexDirty = true;
            }
        }

        return this;
    }

    addComponents(...components: Component[]): this {
        for (const component of components) {
            this._components.push(component);
            component.entity = this;
        }
        this.componentsZIndexDirty = true;

        return this;
    }

    removeComponent(component: Component): void {
        this._components = this._components.filter((c) => c !== component);
    }

    hasComponent(component: Component): boolean {
        return this._components.includes(component);
    }

    getComponent(typeString: string): Component | null {
        return this._components.find((c) => c.name === typeString) ?? null;
    }

    queueRenderCommands(out: RenderCommandStream): void {
        if (!this._enabled || this._children.length + this._components.length === 0) {
            return;
        }

        if (this.#childrenZIndexDirty) {
            this.#sortChildren();
            this.#childrenZIndexDirty = false;
        }
        if (this.#componentsZIndexDirty) {
            this.#sortComponents();
            this.#componentsZIndexDirty = false;
        }

        out.push(
            new RenderCommand(RENDER_CMD.PUSH_TRANSFORM, null, {
                t: this._transform.localMatrix,
            }),
        );

        // Negative z-index children first
        for (const child of this._children) {
            if (child.zIndex < 0 && child.enabled) {
                child.queueRenderCommands(out);
            }
        }

        // Then components
        for (const component of this._components) {
            if (component.enabled) {
                component.queueRenderCommands(out);
            }
        }

        // Then non-negative z-index children
        for (const child of this._children) {
            if (child.zIndex >= 0 && child.enabled) {
                child.queueRenderCommands(out);
            }
        }

        out.push(new RenderCommand(RENDER_CMD.POP_TRANSFORM, null));
    }

    #destroy(): void {
        this._children.forEach((child) => {
            child.#destroy();
        });
        this._components.forEach((component) => {
            component.destroy();
        });

        this._children = [];
        this._components = [];
        this._parent = null;
    }

    #sortByZIndex<T extends { zIndex: number; id: number }>(a: T, b: T): number {
        const zDiff = a.zIndex - b.zIndex;
        if (zDiff !== 0) {
            return zDiff;
        }

        return a.id > b.id ? 1 : -1;
    }

    #sortChildren(): void {
        this._children.sort(this.#sortByZIndex);
        this._children.forEach((child) => {
            child.#sortChildren();
        });
    }

    #sortComponents(): void {
        this._components.sort(this.#sortByZIndex);
    }

    #getComponentsInTree<T extends Component>(typeString: string): RecursiveArray<T> {
        return [
            ...this._children.map((c) => c.getComponentsInTree<T>(typeString)),
            ...this._components.filter((c) => {
                return c.typeString === typeString && c.enabled;
            }),
        ].filter((item) => Object.values(item).length > 0) as RecursiveArray<T>;
    }
}
