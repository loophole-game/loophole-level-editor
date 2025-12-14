import { Component, type ComponentOptions } from '.';
import { Vector, type IVector } from '../math';
import { zoomToScale } from '../utils';
import type { Engine } from '..';
import type { CursorType } from '../systems/pointer';

export interface C_PointerTargetOptions<TEngine extends Engine = Engine>
    extends ComponentOptions<TEngine> {
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    cursorOnHover?: CursorType;
    cursorPriority?: number;
}

export class C_PointerTarget<TEngine extends Engine = Engine> extends Component<TEngine> {
    #onPointerEnter?: C_PointerTargetOptions['onPointerEnter'];
    #onPointerLeave?: C_PointerTargetOptions['onPointerLeave'];
    #cursorOnHover?: CursorType;
    #cursorPriority: number;

    #canInteract: boolean = true;
    #isPointerHovered: boolean = false;

    constructor(options: C_PointerTargetOptions<TEngine>) {
        super(options);

        this.#onPointerEnter = options.onPointerEnter;
        this.#onPointerLeave = options.onPointerLeave;
        this.#cursorOnHover = options.cursorOnHover;
        this.#cursorPriority = options.cursorPriority ?? 5;
    }

    get isPointerHovered(): boolean {
        return this.#isPointerHovered;
    }

    set isPointerHovered(isPointerHovered: boolean) {
        this.#isPointerHovered = isPointerHovered;
    }

    get canInteract(): boolean {
        return this.#canInteract;
    }

    set canInteract(canInteract: boolean) {
        this.#canInteract = canInteract;
    }

    checkIfPointerOver(position: Vector): boolean {
        if (!this.enabled || !this.entity?.enabled || !this.#canInteract) {
            return false;
        }

        const prevIsPointerHovered = this.#isPointerHovered;
        this.#isPointerHovered = false;

        const transform = this.entity?.transform;
        if (transform) {
            // Use cached world matrix and apply camera transform to get scene-space transform
            const camera = this._engine.camera;
            const cameraScale = zoomToScale(camera.zoom);
            const cameraMatrix = new DOMMatrix()
                .translate(camera.position.x, camera.position.y)
                .rotate(camera.rotation)
                .scale(cameraScale, cameraScale);

            // Use cached worldMatrix instead of recomputing
            const sceneMatrix = cameraMatrix.inverse().multiply(transform.worldMatrix as DOMMatrix);

            // Extract scene-space position, rotation, and scale from the matrix
            const scenePosition = new Vector(sceneMatrix.e, sceneMatrix.f);
            const sceneRotation = Math.atan2(sceneMatrix.b, sceneMatrix.a) * (180 / Math.PI);
            const sceneScale = new Vector(
                Math.sqrt(sceneMatrix.a * sceneMatrix.a + sceneMatrix.b * sceneMatrix.b),
                Math.sqrt(sceneMatrix.c * sceneMatrix.c + sceneMatrix.d * sceneMatrix.d),
            );

            // Translate point to be relative to the rectangle's center
            const delta = position.sub(scenePosition);

            // Rotate point in opposite (-rotation) around the center
            const theta = (-sceneRotation * Math.PI) / 180;
            const rotated = delta.rotate(theta);

            // Check bounds (rectangle centered at 0,0)
            const halfWidth = sceneScale.x / 2;
            const halfHeight = sceneScale.y / 2;

            if (
                rotated.x >= -halfWidth &&
                rotated.x <= halfWidth &&
                rotated.y >= -halfHeight &&
                rotated.y <= halfHeight
            ) {
                this.#isPointerHovered = true;
            }
        }

        if (prevIsPointerHovered !== this.#isPointerHovered) {
            if (this.#isPointerHovered) {
                this.#onPointerEnter?.();
                if (this.#cursorOnHover) {
                    const cursorId = `pointer-target-${this.entity?.id}`;
                    this._engine.requestCursor(cursorId, this.#cursorOnHover, this.#cursorPriority);
                }
            } else {
                this.#onPointerLeave?.();
            }
        }

        return this.#isPointerHovered;
    }

    checkIfWithinBox(topLeft: IVector<number>, bottomRight: IVector<number>): boolean {
        if (!this.enabled || !this.entity?.enabled || !this.#canInteract) {
            return false;
        }

        const transform = this.entity?.transform;
        if (!transform) {
            return false;
        }

        // Normalize the box coordinates to ensure correct top-left and bottom-right
        const boxLeft = Math.min(topLeft.x, bottomRight.x);
        const boxRight = Math.max(topLeft.x, bottomRight.x);
        const boxTop = Math.min(topLeft.y, bottomRight.y);
        const boxBottom = Math.max(topLeft.y, bottomRight.y);

        // Use cached world matrix and transform to scene space
        const camera = this._engine.camera;
        const cameraScale = zoomToScale(camera.zoom);
        const cameraMatrix = new DOMMatrix()
            .translate(camera.position.x, camera.position.y)
            .rotate(camera.rotation)
            .scale(cameraScale, cameraScale);
        const cameraInverse = cameraMatrix.inverse();

        // Use pre-calculated bounding box from transform (in world space)
        // Transform the world-space AABB to scene space by applying camera inverse
        const worldBBox = transform.boundingBox;

        // Transform the four corners of the world-space AABB to scene space
        const worldCorners = [
            new DOMPoint(worldBBox.x1, worldBBox.y1),
            new DOMPoint(worldBBox.x2, worldBBox.y1),
            new DOMPoint(worldBBox.x2, worldBBox.y2),
            new DOMPoint(worldBBox.x1, worldBBox.y2),
        ];

        const sceneCorners = worldCorners.map((corner) => cameraInverse.transformPoint(corner));

        // Find the scene-space AABB
        const entityLeft = Math.min(...sceneCorners.map((c) => c.x));
        const entityRight = Math.max(...sceneCorners.map((c) => c.x));
        const entityTop = Math.min(...sceneCorners.map((c) => c.y));
        const entityBottom = Math.max(...sceneCorners.map((c) => c.y));

        // Check if entity's AABB intersects with selection box
        return !(
            entityRight < boxLeft ||
            entityLeft > boxRight ||
            entityBottom < boxTop ||
            entityTop > boxBottom
        );
    }
}
