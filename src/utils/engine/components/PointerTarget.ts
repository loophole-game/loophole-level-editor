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
        super('PointerTarget');

        this.#onPointerEnter = onPointerEnter;
        this.#onPointerLeave = onPointerLeave;
    }

    get isPointerOver(): boolean {
        return this.#isPointerOver;
    }

    checkIfPointerOver(position: Position): boolean {
        const prevIsPointerOver = this.#isPointerOver;
        this.#isPointerOver = false;

        const transform = this.entity?.transform;
        if (transform) {
            // Get world position (center), dimensions, and rotation
            const worldPosition = transform.worldPosition;
            const worldScale = transform.worldScale;
            const worldRotation = transform.worldRotation;

            // Translate point to be relative to the rectangle's center
            const dx = position.x - worldPosition.x;
            const dy = position.y - worldPosition.y;

            // Rotate point in opposite (-rotation) around the center
            const theta = (-worldRotation * Math.PI) / 180; // Convert degrees to radians, negate for undoing entity rotation
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);
            const rotatedX = dx * cosTheta - dy * sinTheta;
            const rotatedY = dx * sinTheta + dy * cosTheta;

            // Check bounds (rectangle centered at 0,0)
            const halfWidth = worldScale.x / 2;
            const halfHeight = worldScale.y / 2;

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
