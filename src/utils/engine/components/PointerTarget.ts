import { Component, type ComponentOptions } from '.';
import { Vector, type IVector } from '../math';
import { zoomToScale } from '../utils';
import type { CursorType } from '../systems/cursor';
import type { Engine } from '..';

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
        if (transform && window.engine) {
            // Compute scene-space matrix by removing camera transform from the entity's world matrix
            const camera = window.engine.camera;
            const scale = zoomToScale(camera.zoom);
            const cameraMatrix = new DOMMatrix()
                .translate(camera.position.x, camera.position.y)
                .rotate(camera.rotation)
                .scale(scale, scale);
            const sceneMatrix = cameraMatrix.inverse().multiply(transform.worldMatrix as DOMMatrix);

            // Extract scene-space position, rotation, and scale
            const scenePosition = new Vector(sceneMatrix.e, sceneMatrix.f);
            const sceneRotation = Math.atan2(sceneMatrix.b, sceneMatrix.a) * (180 / Math.PI);
            const sceneScale = new Vector(
                Math.sqrt(sceneMatrix.a * sceneMatrix.a + sceneMatrix.b * sceneMatrix.b),
                Math.sqrt(sceneMatrix.c * sceneMatrix.c + sceneMatrix.d * sceneMatrix.d),
            );

            // Translate point to be relative to the rectangle's center
            const delta = position.sub(scenePosition);

            // Rotate point in opposite (-rotation) around the center
            const theta = (-sceneRotation * Math.PI) / 180; // Convert degrees to radians, negate for undoing entity rotation
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
                if (this.#cursorOnHover && window.engine) {
                    const cursorId = `pointer-target-${this.entity?.id}`;
                    window.engine.requestCursor(
                        cursorId,
                        this.#cursorOnHover,
                        this.#cursorPriority,
                    );
                }
            } else {
                this.#onPointerLeave?.();
                if (this.#cursorOnHover && window.engine) {
                    const cursorId = `pointer-target-${this.entity?.id}`;
                    window.engine.cancelCursorRequest(cursorId);
                }
            }
        }

        return this.#isPointerHovered;
    }

    checkIfWithinBox(topLeft: IVector<number>, bottomRight: IVector<number>): boolean {
        if (!this.enabled || !this.entity?.enabled || !this.#canInteract) {
            return false;
        }

        const transform = this.entity?.transform;
        if (!transform || !window.engine) {
            return false;
        }

        // Normalize the box coordinates to ensure correct top-left and bottom-right
        const boxLeft = Math.min(topLeft.x, bottomRight.x);
        const boxRight = Math.max(topLeft.x, bottomRight.x);
        const boxTop = Math.min(topLeft.y, bottomRight.y);
        const boxBottom = Math.max(topLeft.y, bottomRight.y);

        // Compute scene-space matrix by removing camera transform from the entity's world matrix
        const camera = window.engine.camera;
        const scale = zoomToScale(camera.zoom);
        const cameraMatrix = new DOMMatrix()
            .translate(camera.position.x, camera.position.y)
            .rotate(camera.rotation)
            .scale(scale, scale);
        const sceneMatrix = cameraMatrix.inverse().multiply(transform.worldMatrix as DOMMatrix);

        // Extract scene-space position
        const scenePosition = new Vector(sceneMatrix.e, sceneMatrix.f);

        // Use worldScale directly, which properly accounts for parent scale
        const worldScale = transform.worldScale;
        const worldRotation = transform.worldRotation;

        // Calculate the four corners of the rotated entity
        const halfWidth = worldScale.x / 2;
        const halfHeight = worldScale.y / 2;
        const theta = (worldRotation * Math.PI) / 180; // Convert to radians
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        // Define corners relative to center (unrotated)
        const corners = [
            new Vector(-halfWidth, -halfHeight), // Top-left
            new Vector(halfWidth, -halfHeight), // Top-right
            new Vector(halfWidth, halfHeight), // Bottom-right
            new Vector(-halfWidth, halfHeight), // Bottom-left
        ];

        // Rotate corners and translate to scene position
        const rotatedCorners = corners.map(
            (corner) =>
                new Vector(
                    scenePosition.x + (corner.x * cosTheta - corner.y * sinTheta),
                    scenePosition.y + (corner.x * sinTheta + corner.y * cosTheta),
                ),
        );

        // Find the axis-aligned bounding box of the rotated entity
        const entityLeft = Math.min(...rotatedCorners.map((c) => c.x));
        const entityRight = Math.max(...rotatedCorners.map((c) => c.x));
        const entityTop = Math.min(...rotatedCorners.map((c) => c.y));
        const entityBottom = Math.max(...rotatedCorners.map((c) => c.y));

        // Check if entity's AABB intersects with selection box
        return !(
            entityRight < boxLeft ||
            entityLeft > boxRight ||
            entityBottom < boxTop ||
            entityTop > boxBottom
        );
    }
}
