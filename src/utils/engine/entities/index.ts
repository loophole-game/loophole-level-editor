import { v4 } from 'uuid';
import type { Component } from '../components';
import type { Position } from '../../levelSchema';
import { RENDER_CMD, RenderCommand, type RenderCommandStream } from '../renderer';
import type { Renderable, Transform } from '../types';

export class Entity implements Renderable {
    protected readonly _id: string;
    protected readonly _name: string;

    protected _enabled: boolean = true;
    protected _transform: Transform = new DOMMatrix();

    protected _position: Position = { x: 0, y: 0 };
    protected _scale: Position = { x: 1, y: 1 };
    protected _rotation: number = 0;
    protected _isTransformDirty: boolean = false;

    protected _zIndex: number = 0;

    protected _parent: Entity | null = null;
    protected _children: Entity[] = [];

    protected _components: Component[];

    constructor(name: string, components: Component[] = []) {
        this._name = name;
        this._components = components;
        this._components.forEach((component) => {
            component.entity = this;
        });

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

    get transform(): Transform | null {
        return this._transform;
    }

    get zIndex(): number {
        return this._zIndex;
    }

    get components(): Component[] {
        return this._components;
    }

    get parent(): Entity | null {
        return this._parent;
    }

    set parent(parent: Entity | null) {
        this._parent = parent;
    }

    get children(): Entity[] {
        return this._children;
    }

    update(deltaTime: number): boolean {
        if (!this._enabled) {
            return false;
        }

        let updated = false;

        if (this._isTransformDirty) {
            this._calculateTransform();
            this._isTransformDirty = false;
            updated = true;
        }

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

    addChildren(...entities: Entity[]): Entity {
        for (const entity of entities) {
            this._children.push(entity);
            entity.parent = this;
        }

        return this;
    }

    removeChild(entity: Entity): void {
        this._children = this._children.filter((e) => e !== entity);
        entity.parent = null;
    }

    setPosition(newPosition: Position): Entity {
        if (this._position.x !== newPosition.x || this._position.y !== newPosition.y) {
            this._position = { ...newPosition };
            this._isTransformDirty = true;
        }

        return this;
    }

    translate(delta: Position): Entity {
        return this.setPosition({
            x: this._position.x + delta.x,
            y: this._position.y + delta.y,
        });
    }

    scale(delta: Position): Entity {
        return this.setScale({
            x: this._scale.x + delta.x,
            y: this._scale.y + delta.y,
        });
    }

    rotate(delta: number): Entity {
        return this.setRotation(this._rotation + delta);
    }

    setScale(newScale: Position): Entity {
        if (this._scale.x !== newScale.x || this._scale.y !== newScale.y) {
            this._scale = { ...newScale };
            this._isTransformDirty = true;
        }

        return this;
    }

    setRotation(newRotation: number): Entity {
        if (this._rotation !== newRotation) {
            this._rotation = newRotation;
            this._isTransformDirty = true;
        }

        return this;
    }

    setZIndex(zIndex: number): Entity {
        this._zIndex = zIndex;

        return this;
    }

    addComponent(component: Component): void {
        this._components.push(component);
    }

    removeComponent(component: Component): void {
        this._components = this._components.filter((c) => c !== component);
    }

    hasComponent(component: Component): boolean {
        return this._components.includes(component);
    }

    getComponent(component: Component): Component | null {
        return this._components.find((c) => c === component) ?? null;
    }

    queueRenderCommands(out: RenderCommandStream): void {
        if (!this._enabled) {
            return;
        }

        for (const component of this._components) {
            if (component.enabled) {
                component.queueRenderCommands(out);
            }
        }

        if (this._children.length > 0) {
            if (this._transform && !this._transform.isIdentity) {
                out.push(
                    new RenderCommand(RENDER_CMD.PUSH_TRANSFORM, null, { t: this._transform }),
                );
            }

            this._children.forEach((child) => {
                child.queueRenderCommands(out);
            });

            if (this._transform && !this._transform.isIdentity) {
                out.push(new RenderCommand(RENDER_CMD.POP_TRANSFORM, null));
            }
        }
    }

    _calculateTransform(): void {
        // Build transformation matrix: T * R * S
        // We need to apply operations in reverse order for post-multiplication,
        // OR use proper matrix multiplication

        const matrix = new DOMMatrix();

        // First, translate to position (this happens LAST in the transform chain)
        matrix.translateSelf(this._position.x, this._position.y);

        // Then rotate (this happens in the middle)
        matrix.rotateSelf(this._rotation);

        // Finally scale (this happens FIRST to the actual geometry)
        matrix.scaleSelf(this._scale.x, this._scale.y);

        this._transform = matrix;
    }
}
