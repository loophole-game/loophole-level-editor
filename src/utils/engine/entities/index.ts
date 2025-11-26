import type { Component, ComponentOptions } from '../components';
import { RENDER_CMD, RenderCommand, type RenderCommandStream } from '../systems/render';
import type { Camera, RecursiveArray, Renderable } from '../types';
import { Vector, type IVector } from '../math';
import { C_Transform } from '../components/transforms';
import { zoomToScale } from '../utils';
import type { Engine } from '..';

interface ScaleToCamera {
    x: boolean;
    y: boolean;
}

export interface EntityOptions<TEngine extends Engine = Engine> {
    engine: TEngine;
    name?: string;
    enabled?: boolean;
    zIndex?: number;
    position?: number | IVector<number> | Vector;
    scale?: number | IVector<number> | Vector;
    rotation?: number;
    scaleToCamera?: boolean | ScaleToCamera;
    scene?: string;
    components?: Component<TEngine>[];
    children?: Entity<TEngine>[];
}

export class Entity<TEngine extends Engine = Engine> implements Renderable {
    protected static _nextId: number = 1;
    protected readonly _id: string = (Entity._nextId++).toString();
    protected readonly _name: string;
    protected _engine: TEngine;

    protected _enabled: boolean = true;
    protected _updated: boolean = false;

    protected _zIndex: number = 0;

    protected _parent: Entity<TEngine> | null = null;
    protected _transform: C_Transform<TEngine>;
    protected _scaleToCamera: ScaleToCamera = { x: false, y: false };

    protected _children: Entity<TEngine>[] = [];
    #childrenZIndexDirty: boolean = false;

    protected _components: Component<TEngine>[] = [];
    #componentsZIndexDirty: boolean = false;

    constructor(options: EntityOptions<TEngine>) {
        const { name = `entity-${this._id}`, engine, ...rest } = options;
        this._name = name;
        this._engine = engine;
        this._enabled = rest?.enabled ?? true;
        this._zIndex = rest?.zIndex ?? 0;
        this._scaleToCamera = rest?.scaleToCamera
            ? typeof rest.scaleToCamera === 'boolean'
                ? { x: rest.scaleToCamera, y: rest.scaleToCamera }
                : rest.scaleToCamera
            : { x: false, y: false };
        this._components = rest?.components ?? [];
        this._children = rest?.children ?? [];

        this._transform = this.addComponents(C_Transform<TEngine>, {
            position: rest?.position ?? 0,
            rotation: rest?.rotation ?? 0,
            scale: rest?.scale ?? 1,
        });

        this._components.forEach((component) => {
            component.entity = this;
        });
        this._children.forEach((child) => {
            child.parent = this;
        });
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

    get engine(): Engine | null {
        return this._engine;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    get transform(): C_Transform {
        return this._transform;
    }

    get position(): Readonly<Vector> {
        return this._transform.position;
    }

    get worldPosition(): Readonly<Vector> {
        return this._transform.worldPosition;
    }

    get scale(): Readonly<Vector> {
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

    get parent(): Readonly<Entity<TEngine>> | null {
        return this._parent;
    }

    set parent(parent: Entity<TEngine> | null) {
        if (parent) {
            parent.registerChild(this);
            if (this.parent !== parent) {
                parent.childrenZIndexDirty = true;
            }
        }
        this._parent = parent;
    }

    get children(): ReadonlyArray<Entity<TEngine>> {
        return this._children;
    }

    addEntities<
        T extends Entity<TEngine>,
        TOptions extends EntityOptions<TEngine> = EntityOptions<TEngine>,
    >(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine'> & { scene?: string },
    ): T;
    addEntities<
        T extends Entity<TEngine>,
        TOptions extends EntityOptions<TEngine> = EntityOptions<TEngine>,
    >(
        ctor: new (options: TOptions) => T,
        ...optionObjs: (Omit<TOptions, 'engine'> & { scene?: string })[]
    ): T[];
    addEntities<
        T extends Entity<TEngine>,
        TOptions extends EntityOptions<TEngine> = EntityOptions<TEngine>,
    >(
        ctor: new (options: TOptions) => T,
        ...optionObjs: (Omit<TOptions, 'engine'> & { scene?: string })[]
    ): T | T[] {
        const instances = optionObjs.map((option) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entity = new ctor({ ...option, engine: this._engine } as any);
            entity.parent = this;
            return entity;
        });
        return instances.length === 1 ? instances[0] : instances;
    }

    addComponents<
        T extends Component<TEngine>,
        TOptions extends ComponentOptions<TEngine> = ComponentOptions<TEngine>,
    >(ctor: new (options: TOptions) => T, options: Omit<TOptions, 'engine'>): T;
    addComponents<
        T extends Component<TEngine>,
        TOptions extends ComponentOptions<TEngine> = ComponentOptions<TEngine>,
    >(ctor: new (options: TOptions) => T, ...optionObjs: Omit<TOptions, 'engine'>[]): T[];
    addComponents<
        T extends Component<TEngine>,
        TOptions extends ComponentOptions<TEngine> = ComponentOptions<TEngine>,
    >(ctor: new (options: TOptions) => T, ...optionObjs: Omit<TOptions, 'engine'>[]): T | T[] {
        const components = optionObjs.map((option) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const component = new ctor({ ...option, engine: this._engine } as any);
            component.entity = this;
            this._components.push(component);
            return component;
        });
        return components.length === 1 ? components[0] : components;
    }

    registerChild(child: Entity<TEngine>): void {
        this._children.push(child);
    }

    getComponentsInTree<T extends Component>(typeString: string): T[] {
        return this.#getComponentsInTree<T>(typeString).flat() as T[];
    }

    engineUpdate(deltaTime: number): boolean {
        let updated = this._updated;
        this._updated = false;

        for (const component of this._components) {
            if (component.enabled) {
                updated = component.update(deltaTime) || updated;
            }
        }

        for (const child of this._children) {
            if (child.enabled) {
                updated = child.engineUpdate(deltaTime) || updated;
            }
        }

        updated = this.update(deltaTime) || updated;

        return updated;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    engineLateUpdate(_deltaTime: number, engine: Engine) {
        for (const child of this._children) {
            if (child.enabled) {
                child.engineLateUpdate(_deltaTime, engine);
            }
        }

        if (this._scaleToCamera.x || this._scaleToCamera.y) {
            const scale = zoomToScale(engine.camera.zoom);
            this.transform.setScaleMult(
                new Vector(
                    this._scaleToCamera.x ? 1 / scale : 1,
                    this._scaleToCamera.y ? 1 / scale : 1,
                ),
            );
        }
    }

    destroy(): void {
        this._parent?.removeChildren(this);
        this.#destroy();
    }

    removeChildren(...entities: Entity<TEngine>[]): void {
        this._children = [...this._children.filter((e) => entities.every((ic) => e.id !== ic.id))];
    }

    setEnabled(enabled: boolean): this {
        this._enabled = enabled;

        return this;
    }

    setPosition(newPosition: number | IVector<number> | Vector): this {
        this._transform.setPosition(newPosition);

        return this;
    }

    setScale(newScale: number | IVector<number> | Vector): this {
        this._transform.setScale(newScale);

        return this;
    }

    setRotation(newRotation: number): this {
        this._transform.setRotation(newRotation);

        return this;
    }

    translate(delta: Vector): this {
        this._transform.translate(delta);

        return this;
    }

    scaleBy(delta: Vector): this {
        this._transform.scaleBy(delta);

        return this;
    }

    rotate(delta: number): this {
        this._transform.rotate(delta);

        return this;
    }

    setZIndex(zIndex: number): this {
        if (this._zIndex !== zIndex && !isNaN(zIndex)) {
            this._zIndex = zIndex;
            if (this._parent) {
                this._parent.childrenZIndexDirty = true;
            }
        }

        return this;
    }

    setScaleToCamera(scaleToCamera: boolean | ScaleToCamera): this {
        this._scaleToCamera =
            typeof scaleToCamera === 'boolean'
                ? { x: scaleToCamera, y: scaleToCamera }
                : scaleToCamera;

        return this;
    }

    removeComponents(...components: Component[]): this {
        this._components = this._components.filter((c) => components.every((ic) => c.id !== ic.id));
        return this;
    }

    hasComponent(component: Component<TEngine>): boolean {
        return this._components.includes(component);
    }

    getComponent(typeString: string): Component<TEngine> | null {
        return this._components.find((c) => c.name === typeString) ?? null;
    }

    queueRenderCommands(out: RenderCommandStream, camera: Camera): void {
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
                child.queueRenderCommands(out, camera);
            }
        }

        // Then components
        for (const component of this._components) {
            if (component.enabled) {
                component.queueRenderCommands(out, camera);
            }
        }

        // Then non-negative z-index children
        for (const child of this._children) {
            if (child.zIndex >= 0 && child.enabled) {
                child.queueRenderCommands(out, camera);
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

    #sortByZIndex<T extends { zIndex: number; id: string }>(a: T, b: T): number {
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
        if (!this.enabled) {
            return [];
        }

        return [
            ...this._children.map((c) => c.getComponentsInTree<T>(typeString)),
            ...this._components.filter((c) => {
                return c.typeString === typeString && c.enabled;
            }),
        ].filter((item) => Object.values(item).length > 0) as RecursiveArray<T>;
    }
}
