import { Component, type ComponentOptions } from '.';
import { Vector } from '../math';
import { boundingBoxesIntersect } from '../utils';
import type { CursorType } from '../systems/pointer';
import type { BoundingBox } from '../types';

export interface C_PointerTargetOptions extends ComponentOptions {
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    cursorOnHover?: CursorType;
    cursorPriority?: number;
}

export class C_PointerTarget extends Component {
    #onPointerEnter?: C_PointerTargetOptions['onPointerEnter'];
    #onPointerLeave?: C_PointerTargetOptions['onPointerLeave'];
    #cursorOnHover?: CursorType;
    #cursorPriority: number;

    #canInteract: boolean = true;
    #isPointerHovered: boolean = false;

    constructor(options: C_PointerTargetOptions) {
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

    checkIfPointerOver(worldPosition: Vector): boolean {
        if (!this.enabled || !this.entity?.enabled || !this.#canInteract) {
            return false;
        }

        const prevIsPointerHovered = this.#isPointerHovered;
        this.#isPointerHovered = false;

        const transform = this.entity?.transform;
        if (transform) {
            const bbox = transform.boundingBox;
            if (
                worldPosition.x >= bbox.x1 &&
                worldPosition.x <= bbox.x2 &&
                worldPosition.y >= bbox.y1 &&
                worldPosition.y <= bbox.y2
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

    checkIfWithinBox(bbox: BoundingBox): boolean {
        if (!this.enabled || !this.entity?.enabled || !this.#canInteract) {
            return false;
        }

        const transform = this.entity?.transform;
        if (!transform) {
            return false;
        }

        return boundingBoxesIntersect(bbox, transform.boundingBox);
    }
}
