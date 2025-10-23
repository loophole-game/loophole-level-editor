import { Component } from '.';
import type { Position } from '../types';

interface PointerTargetOptions {
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
}

export class C_PointerTarget extends Component {
    #onPointerEnter?: PointerTargetOptions['onPointerEnter'];
    #onPointerLeave?: PointerTargetOptions['onPointerLeave'];

    #isPointerOver: boolean = false;

    constructor({ onPointerEnter, onPointerLeave }: PointerTargetOptions = {}) {
        super(C_PointerTarget.name);

        this.#onPointerEnter = onPointerEnter;
        this.#onPointerLeave = onPointerLeave;
    }

    get isPointerOver(): boolean {
        return this.#isPointerOver;
    }

    set isPointerOver(isPointerOver: boolean) {
        this.#isPointerOver = isPointerOver;
    }

    checkIfPointerOver(position: Position): boolean {
        const prevIsPointerOver = this.#isPointerOver;
        this.#isPointerOver = false;

        const transform = this.entity?.transform;
        if (transform && window.engine) {
            // Compute scene-space matrix by removing camera transform from the entity's world matrix
            const camera = window.engine.camera;
            const cameraMatrix = new DOMMatrix()
                .translate(camera.position.x, camera.position.y)
                .rotate(camera.rotation)
                .scale(camera.zoom, camera.zoom);
            const sceneMatrix = cameraMatrix.inverse().multiply(transform.worldMatrix as DOMMatrix);

            // Extract scene-space position, rotation, and scale
            const scenePosition = { x: sceneMatrix.e, y: sceneMatrix.f };
            const sceneRotation = Math.atan2(sceneMatrix.b, sceneMatrix.a) * (180 / Math.PI);
            const sceneScale = {
                x: Math.sqrt(sceneMatrix.a * sceneMatrix.a + sceneMatrix.b * sceneMatrix.b),
                y: Math.sqrt(sceneMatrix.c * sceneMatrix.c + sceneMatrix.d * sceneMatrix.d),
            };

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
            const halfWidth = sceneScale.x / 2;
            const halfHeight = sceneScale.y / 2;

            if (
                rotatedX >= -halfWidth &&
                rotatedX <= halfWidth &&
                rotatedY >= -halfHeight &&
                rotatedY <= halfHeight
            ) {
                this.#isPointerOver = true;
            }
        }

        if (prevIsPointerOver !== this.#isPointerOver) {
            if (this.#isPointerOver) {
                this.#onPointerEnter?.();
            } else {
                this.#onPointerLeave?.();
            }
        }

        return this.#isPointerOver;
    }
}
