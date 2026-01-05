import type { Component, ComponentOptions } from '../components';
import type { BoundingBox, Camera, OneAxisAlignment, Renderable } from '../types';
import { Vector, type IVector, type VectorConstructor } from '../math';
import { C_Transform } from '../components/transforms';
import { boundingBoxesIntersect, zoomToScale } from '../utils';
import type { Engine } from '..';
import type { RenderCommandStream } from '../systems/render/command';

type CullMode = 'components' | 'children' | 'all' | 'none';
type PositionRelativeToCamera = OneAxisAlignment | 'none';
export interface EntityOptions {
    name?: string;
    enabled?: boolean;
    zIndex?: number;
    cull?: CullMode;
    position?: number | IVector<number> | Vector;
    scale?: number | IVector<number> | Vector;
    rotation?: number;
    positionRelativeToCamera?: VectorConstructor<PositionRelativeToCamera>;
    scaleRelativeToCamera?: VectorConstructor<boolean>;
    scene?: string;
    components?: Component[];
    children?: Entity[];
}

interface InternalEntityOptions<TEngine extends Engine = Engine> extends EntityOptions {
    engine: TEngine;
}

export class Entity<TEngine extends Engine = Engine> implements Renderable {
    protected static _nextId: number = 1;
    protected readonly _id: string = (Entity._nextId++).toString();

    protected readonly _name: string;
    protected _engine: TEngine;

    protected _enabled: boolean;
    protected _zIndex: number;

    protected _transform: C_Transform;
    protected _positionRelativeToCamera: IVector<PositionRelativeToCamera>;
    protected _scaleRelativeToCamera: IVector<boolean>;
    protected _cull: CullMode;

    protected _updated: boolean = false;
    protected _parent: Entity | null = null;

    protected _children: Entity[];
    #childrenZIndexDirty: boolean = false;

    protected _components: Component[];
    #componentsZIndexDirty: boolean = false;

    protected _cachedComponentsInTree: Record<string, Component[]> = {};

    constructor(options: EntityOptions) {
        const {
            name = `entity-${this._id}`,
            engine,
            ...rest
        } = options as InternalEntityOptions<TEngine>;
        this._name = name;
        this._engine = engine;
        this._enabled = rest?.enabled ?? true;
        this._zIndex = rest?.zIndex ?? 0;

        this._positionRelativeToCamera = rest?.positionRelativeToCamera
            ? typeof rest.positionRelativeToCamera === 'string'
                ? { x: rest.positionRelativeToCamera, y: rest.positionRelativeToCamera }
                : rest.positionRelativeToCamera
            : { x: 'none', y: 'none' };
        this._scaleRelativeToCamera = rest?.scaleRelativeToCamera
            ? typeof rest.scaleRelativeToCamera === 'boolean'
                ? { x: rest.scaleRelativeToCamera, y: rest.scaleRelativeToCamera }
                : rest.scaleRelativeToCamera
            : { x: false, y: false };

        this._cull = rest?.cull ?? 'all';
        this._components = rest?.components ?? [];
        this._children = rest?.children ?? [];

        this._transform = this.addComponents(C_Transform, {
            position: rest?.position ?? 0,
            rotation: rest?.rotation ?? 0,
            scale: rest?.scale ?? 1,
        });

        for (const child of this._children) {
            child.parent = this;
        }
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

    get engine(): Engine {
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

    get cull(): CullMode {
        return this._cull;
    }

    set componentsZIndexDirty(dirty: boolean) {
        this.#componentsZIndexDirty = dirty;
    }

    set childrenZIndexDirty(dirty: boolean) {
        this.#childrenZIndexDirty = dirty;
    }

    get components(): ReadonlyArray<Component<TEngine>> {
        return this._components as Component<TEngine>[];
    }

    get parent(): Readonly<Entity> | null {
        return this._parent;
    }

    set parent(parent: Entity | null) {
        if (parent) {
            parent.registerChild(this);
            if (this.parent !== parent) {
                parent.childrenZIndexDirty = true;
            }
        }
        this._parent = parent;
    }

    get children(): ReadonlyArray<Entity<TEngine>> {
        return this._children as Entity<TEngine>[];
    }

    addEntities<T extends Entity, TOptions extends EntityOptions = EntityOptions>(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine'> & { scene?: string },
    ): T;
    addEntities<T extends Entity, TOptions extends EntityOptions = EntityOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: (Omit<TOptions, 'engine'> & { scene?: string })[]
    ): T[];
    addEntities<T extends Entity, TOptions extends EntityOptions = EntityOptions>(
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

    addComponents<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine' | 'entity'>,
    ): T;
    addComponents<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: Omit<TOptions, 'engine' | 'entity'>[]
    ): T[];
    addComponents<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: Omit<TOptions, 'engine' | 'entity'>[]
    ): T | T[] {
        const components = optionObjs.map((option) => {
            const component = new ctor({
                ...option,
                engine: this._engine,
                entity: this,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any) as T;
            this._components.push(component);
            return component;
        });

        return components.length === 1 ? components[0] : components;
    }

    registerChild(child: Entity): void {
        this._children.push(child);
    }

    getComponentsInTree<T extends Component>(typeString: string): T[] {
        if (typeString in this._cachedComponentsInTree) {
            return this._cachedComponentsInTree[typeString] as T[];
        }

        const out: T[] = [];
        this.#getComponentsInTree<T>(typeString, out);
        this._cachedComponentsInTree[typeString] = out;

        return out;
    }

    onChildComponentsOfTypeChanged(typeString: string): void {
        delete this._cachedComponentsInTree[typeString];
        if (this._parent) {
            this._parent.onChildComponentsOfTypeChanged(typeString);
        }
    }

    engineUpdate(deltaTime: number): boolean {
        let updated = this._updated;
        this._updated = false;

        for (const child of this._children) {
            if (child.enabled) {
                updated = child.engineUpdate(deltaTime) || updated;
            }
        }

        for (const component of this._components) {
            if (component.enabled) {
                updated = component.update(deltaTime) || updated;
            }
        }

        updated = this.update(deltaTime) || updated;

        return updated;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    destroy(): void {
        if (this._parent)
            this._parent._children = this._parent._children.filter((e) => e.id !== this.id);
        this.#destroy();
    }

    removeChildren(...entities: Entity[]): void {
        for (const entity of entities) {
            entity.destroy();
        }
    }

    setEnabled(enabled: boolean): this {
        if (this._enabled !== enabled) {
            this._enabled = enabled;

            for (const component of this._components) {
                component.setEnabled(enabled);
            }
            for (const child of this._children) {
                child.setEnabled(enabled);
            }
        }

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

    setPositionRelativeToCamera(
        positionRelativeToCamera: VectorConstructor<PositionRelativeToCamera>,
    ): this {
        this._positionRelativeToCamera =
            typeof positionRelativeToCamera === 'string'
                ? { x: positionRelativeToCamera, y: positionRelativeToCamera }
                : positionRelativeToCamera;

        return this;
    }

    setScaleRelativeToCamera(scaleRelativeToCamera: VectorConstructor<boolean>): this {
        this._scaleRelativeToCamera =
            typeof scaleRelativeToCamera === 'boolean'
                ? { x: scaleRelativeToCamera, y: scaleRelativeToCamera }
                : scaleRelativeToCamera;

        return this;
    }

    setCull(cull: CullMode): this {
        this._cull = cull;
        return this;
    }

    removeComponents(...components: Component[]): this {
        this._components = this._components.filter((c) => components.every((ic) => c.id !== ic.id));
        return this;
    }

    hasComponent(component: Component): boolean {
        return this._components.includes(component);
    }

    getComponent(typeString: string): Component | null {
        return this._components.find((c) => c.name === typeString) ?? null;
    }

    queueRenderCommands(stream: RenderCommandStream, camera: Camera): void {
        if (!this._enabled || this._children.length + this._components.length === 0) {
            return;
        }

        // Apply camera scaling only if we need to render
        if (this._scaleRelativeToCamera.x || this._scaleRelativeToCamera.y) {
            const scale = zoomToScale(camera.zoom);
            this.transform.setScaleMult(
                new Vector(
                    this._scaleRelativeToCamera.x ? 1 / scale : 1,
                    this._scaleRelativeToCamera.y ? 1 / scale : 1,
                ),
            );
        }

        // Apply camera position offset only if we need to render
        if (
            this._positionRelativeToCamera.x !== 'none' ||
            this._positionRelativeToCamera.y !== 'none'
        ) {
            const scale = zoomToScale(camera.zoom);

            // Calculate world center of the camera viewport
            const worldCenterOffset = {
                x: -camera.position.x / scale,
                y: -camera.position.y / scale,
            };

            // Account for camera rotation
            const rotationRad = (-camera.rotation * Math.PI) / 180;
            const cosRot = Math.cos(rotationRad);
            const sinRot = Math.sin(rotationRad);
            const worldCenterX = worldCenterOffset.x * cosRot - worldCenterOffset.y * sinRot;
            const worldCenterY = worldCenterOffset.x * sinRot + worldCenterOffset.y * cosRot;

            // Calculate offset based on anchor position (in world space, before rotation)
            let xOffsetLocal = 0;
            let yOffsetLocal = 0;
            switch (this._positionRelativeToCamera.x) {
                case 'start':
                    xOffsetLocal = -camera.size.x / 2;
                    break;
                case 'center':
                    xOffsetLocal = 0;
                    break;
                case 'end':
                    xOffsetLocal = camera.size.x / 2;
                    break;
            }
            switch (this._positionRelativeToCamera.y) {
                case 'start':
                    yOffsetLocal = -camera.size.y / 2;
                    break;
                case 'center':
                    yOffsetLocal = 0;
                    break;
                case 'end':
                    yOffsetLocal = camera.size.y / 2;
                    break;
            }

            // Rotate the offset by camera rotation to get world space offset
            const xOffsetWorld = xOffsetLocal * cosRot - yOffsetLocal * sinRot;
            const yOffsetWorld = xOffsetLocal * sinRot + yOffsetLocal * cosRot;

            // Final position offset is: world center + rotated offset
            this.transform.setPositionOffset({
                x:
                    this._positionRelativeToCamera.x !== 'none'
                        ? worldCenterX +
                          xOffsetWorld -
                          this.position.x +
                          this.position.x * this.transform.scaleMult.x
                        : 0,
                y:
                    this._positionRelativeToCamera.y !== 'none'
                        ? worldCenterY +
                          yOffsetWorld -
                          this.position.y +
                          this.position.y * this.transform.scaleMult.y
                        : 0,
            });
        }

        const culled = this._cull !== 'none' && this.isCulled(camera.cullBoundingBox);
        if (culled && this._cull === 'all') {
            return;
        }

        const cullChildren = culled && this._cull === 'children';
        const cullComponents = culled && this._cull === 'components';

        if (this.#childrenZIndexDirty && !cullChildren) {
            this.#sortChildren();
            this.#childrenZIndexDirty = false;
        }
        if (this.#componentsZIndexDirty && !cullComponents) {
            this.#sortComponents();
            this.#componentsZIndexDirty = false;
        }

        stream.pushTransform(this._transform.localMatrix);

        if (!cullChildren) {
            // Negative z-index children first
            for (const child of this._children) {
                if (child.zIndex < 0 && child.enabled) {
                    child.queueRenderCommands(stream, camera);
                }
            }
        }

        if (!cullComponents) {
            // Then components
            for (const component of this._components) {
                if (component.enabled) {
                    component.queueRenderCommands(stream, camera);
                }
            }
        }

        if (!cullChildren) {
            // Then non-negative z-index children
            for (const child of this._children) {
                if (child.zIndex >= 0 && child.enabled) {
                    child.queueRenderCommands(stream, camera);
                }
            }
        }

        stream.popTransform();
    }

    isCulled(cameraBoundingBox: BoundingBox): boolean {
        return !boundingBoxesIntersect(this.transform.boundingBox, cameraBoundingBox);
    }

    #destroy(): void {
        for (const child of this._children) {
            child.#destroy();
        }
        for (const component of this._components) {
            component.destroy();
        }

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
        for (const child of this._children) {
            child.#sortChildren();
        }
    }

    #sortComponents(): void {
        this._components.sort(this.#sortByZIndex);
    }

    #getComponentsInTree<T extends Component>(typeString: string, out: T[]): void {
        if (!this.enabled) {
            return;
        }

        for (const child of this._children) {
            child.#getComponentsInTree(typeString, out);
        }

        for (const comp of this._components) {
            if (comp.enabled && comp.typeString === typeString) {
                out.push(comp as T);
            }
        }
    }
}
