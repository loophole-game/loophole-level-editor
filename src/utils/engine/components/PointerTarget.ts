import { Component } from '.';
import type { Position } from '../types';
import { zoomToScale } from '../utils';
import type { CursorType } from '../systems/cursor';

interface PointerTargetOptions {
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    cursorOnHover?: CursorType;
    cursorPriority?: number;
}

export class C_PointerTarget extends Component {
    #onPointerEnter?: PointerTargetOptions['onPointerEnter'];
    #onPointerLeave?: PointerTargetOptions['onPointerLeave'];
    #cursorOnHover?: CursorType;
    #cursorPriority: number;

    #canInteract: boolean = true;
    #isPointerHovered: boolean = false;
    
    // Cache for matrix calculations to avoid creating new objects every frame
    #cameraMatrix: DOMMatrix = new DOMMatrix();
    #sceneMatrix: DOMMatrix = new DOMMatrix();

    constructor({
        onPointerEnter,
        onPointerLeave,
        cursorOnHover,
        cursorPriority = 5,
    }: PointerTargetOptions = {}) {
        super(C_PointerTarget.name);

        this.#onPointerEnter = onPointerEnter;
        this.#onPointerLeave = onPointerLeave;
        this.#cursorOnHover = cursorOnHover;
        this.#cursorPriority = cursorPriority;
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

    checkIfPointerOver(position: Position): boolean {
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
            
            // Reuse cached matrix objects instead of creating new ones
            this.#cameraMatrix.a = scale;
            this.#cameraMatrix.b = 0;
            this.#cameraMatrix.c = 0;
            this.#cameraMatrix.d = scale;
            this.#cameraMatrix.e = 0;
            this.#cameraMatrix.f = 0;
            this.#cameraMatrix.rotateSelf(camera.rotation);
            this.#cameraMatrix.translateSelf(camera.position.x, camera.position.y);
            
            this.#sceneMatrix = this.#cameraMatrix.inverse().multiply(transform.worldMatrix as DOMMatrix);

            // Extract scene-space position, rotation, and scale
            const scenePosition = { x: this.#sceneMatrix.e, y: this.#sceneMatrix.f };
            const sceneRotation = Math.atan2(this.#sceneMatrix.b, this.#sceneMatrix.a) * (180 / Math.PI);
            const sceneScaleX = Math.hypot(this.#sceneMatrix.a, this.#sceneMatrix.b);
            const sceneScaleY = Math.hypot(this.#sceneMatrix.c, this.#sceneMatrix.d);

            // Translate point to be relative to the rectangle's center
            const dx = position.x - scenePosition.x;
            const dy = position.y - scenePosition.y;

            // Rotate point in opposite (-rotation) around the center
            const theta = (-sceneRotation * Math.PI) / 180; // Convert degrees to radians, negate for undoing entity rotation
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);
            const rotatedX = dx * cosTheta - dy * sinTheta;
            const rotatedY = dx * sinTheta + dy * cosTheta;

            // Check bounds (rectangle centered at 0,0)
            const halfWidth = sceneScaleX / 2;
            const halfHeight = sceneScaleY / 2;

            if (
                rotatedX >= -halfWidth &&
                rotatedX <= halfWidth &&
                rotatedY >= -halfHeight &&
                rotatedY <= halfHeight
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

    checkIfWithinBox(topLeft: Position, bottomRight: Position): boolean {
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
        
        // Reuse cached matrix objects
        this.#cameraMatrix.a = scale;
        this.#cameraMatrix.b = 0;
        this.#cameraMatrix.c = 0;
        this.#cameraMatrix.d = scale;
        this.#cameraMatrix.e = 0;
        this.#cameraMatrix.f = 0;
        this.#cameraMatrix.rotateSelf(camera.rotation);
        this.#cameraMatrix.translateSelf(camera.position.x, camera.position.y);
        
        this.#sceneMatrix = this.#cameraMatrix.inverse().multiply(transform.worldMatrix as DOMMatrix);

        // Extract scene-space position
        const scenePosition = { x: this.#sceneMatrix.e, y: this.#sceneMatrix.f };

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
            { x: -halfWidth, y: -halfHeight }, // Top-left
            { x: halfWidth, y: -halfHeight }, // Top-right
            { x: halfWidth, y: halfHeight }, // Bottom-right
            { x: -halfWidth, y: halfHeight }, // Bottom-left
        ];

        // Rotate corners and translate to scene position
        const rotatedCorners = corners.map((corner) => ({
            x: scenePosition.x + (corner.x * cosTheta - corner.y * sinTheta),
            y: scenePosition.y + (corner.x * sinTheta + corner.y * cosTheta),
        }));

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
