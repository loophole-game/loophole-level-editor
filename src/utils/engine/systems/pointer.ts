import { System } from '.';
import { C_PointerTarget } from '../components/PointerTarget';
import { Vector, type IVector, type VectorConstructor } from '../math';
import type { BoundingBox } from '../types';
import type { ButtonState } from './input';

const MAX_DISTANCE_DURING_CLICK = 10;
const DRAG_CURSOR_PRIORITY = 100;

export type CursorType =
    | 'default'
    | 'pointer'
    | 'crosshair'
    | 'grab'
    | 'grabbing'
    | 'move'
    | 'ew-resize'
    | 'ns-resize'
    | 'nwse-resize'
    | 'nesw-resize'
    | 'not-allowed'
    | 'none';

interface CursorRequest {
    type: CursorType;
    priority: number;
}

export interface PointerButtonState extends ButtonState {
    clicked: boolean;
}

export const PointerButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
} as const;
export type PointerButton = (typeof PointerButton)[keyof typeof PointerButton];

export interface PointerState extends Record<PointerButton, PointerButtonState> {
    scrollDelta: number;
    justMoved: boolean;
    onScreen: boolean;
    justMovedOnScreen: boolean;
    justMovedOffScreen: boolean;
    position: Vector;
    worldPosition: Vector;
    clickStartPosition: Vector | null;
    clickEndPosition: Vector | null;
}

export type CameraScrollMode = 'none' | 'all' | 'meta' | 'no-meta';

const SCROLL_DELTA_PER_STEP = 120;

export class PointerSystem extends System {
    #pointerState: PointerState = {
        scrollDelta: 0,
        justMoved: false,
        position: new Vector(0),
        worldPosition: new Vector(0),
        clickStartPosition: null,
        clickEndPosition: null,
        onScreen: false,
        justMovedOnScreen: false,
        justMovedOffScreen: false,
        [PointerButton.LEFT]: {
            down: false,
            downAsNum: 0,
            pressed: false,
            released: false,
            clicked: false,
            downTime: 0,
            numHeldPresses: 0,
        },
        [PointerButton.MIDDLE]: {
            down: false,
            downAsNum: 0,
            pressed: false,
            released: false,
            clicked: false,
            downTime: 0,
            numHeldPresses: 0,
        },
        [PointerButton.RIGHT]: {
            down: false,
            downAsNum: 0,
            pressed: false,
            released: false,
            clicked: false,
            downTime: 0,
            numHeldPresses: 0,
        },
    };
    #lastPointerState: PointerState = {
        ...this.#pointerState,
        position: new Vector(0),
        worldPosition: new Vector(0),
    };
    #accumulatedScrollDelta: number = 0;
    #scrollSteps: number = 0;

    #dragStartMousePosition: IVector<number> | null = null;
    #dragStartCameraPosition: IVector<number> | null = null;

    #checkForOverlap: boolean = true;

    #canvas: HTMLCanvasElement | null = null;
    #currentCursor: CursorType = 'default';
    #cursorRequests: Map<string, CursorRequest> = new Map();

    get pointerState(): Readonly<PointerState> {
        return this.#pointerState;
    }

    get pointerPosition(): Vector {
        return this.#pointerState.position;
    }

    set pointerPosition(position: VectorConstructor) {
        this.#pointerState.position.set(position);
        this.#pointerState.justMovedOnScreen = !this.#pointerState.onScreen;
        this.#pointerState.justMovedOffScreen = false;
        this.#pointerState.justMoved = true;
        this.#pointerState.onScreen = true;
    }

    set pointerScrollDelta(delta: number) {
        this.#pointerState.scrollDelta = delta;
    }

    get pointerWorldPosition(): Readonly<IVector<number>> {
        return this.#pointerState.worldPosition.extract();
    }

    get pointerOnScreen(): boolean {
        return this.#pointerState.onScreen;
    }

    set pointerOnScreen(onScreen: boolean) {
        this.#pointerState.justMovedOnScreen = !this.#pointerState.onScreen && onScreen;
        this.#pointerState.justMovedOffScreen = this.#pointerState.onScreen && !onScreen;
        this.#pointerState.onScreen = onScreen;
    }

    set checkForOverlap(checkForOverlap: boolean) {
        this.#checkForOverlap = checkForOverlap;
    }

    get checkForOverlap(): boolean {
        return this.#checkForOverlap;
    }

    get currentCursor(): CursorType {
        return this.#currentCursor;
    }

    set canvas(canvas: HTMLCanvasElement | null) {
        this.#canvas = canvas;
        this.#applyCursor();
    }

    getPointerButton(button: PointerButton): PointerButtonState {
        return this.#pointerState[button];
    }

    get scrollSteps(): number {
        return this.#scrollSteps;
    }

    pointerButtonStateChange(button: PointerButton, down: boolean) {
        this.#pointerState[button] = {
            ...this.#pointerState[button],
            down,
            downAsNum: down ? 1 : 0,
            downTime: 0,
        };
        const position = this.#pointerState.position;
        if (down) {
            this.#pointerState.clickStartPosition = position.clone();
            this.#pointerState.clickEndPosition = null;
        } else {
            this.#pointerState.clickEndPosition = position;
        }
    }

    override earlyUpdate(deltaTime: number) {
        this.#pointerState.justMoved =
            this.#pointerState.position.x !== this.#lastPointerState.position.x ||
            this.#pointerState.position.y !== this.#lastPointerState.position.y;
        this.#pointerState.worldPosition.set(
            this._engine.screenToWorld(this.#pointerState.position),
        );
        Object.values(PointerButton).forEach((button: PointerButton) => {
            this.#pointerState[button].pressed =
                this.#pointerState[button].down && !this.#lastPointerState[button].down;
            this.#pointerState[button].released =
                !this.#pointerState[button].down && this.#lastPointerState[button].down;
            this.#pointerState[button].clicked = false;

            if (
                this.#pointerState[button].released &&
                this.#pointerState.clickStartPosition &&
                this.#pointerState.clickEndPosition
            ) {
                const distanceTraveled = this.#pointerState.clickEndPosition.distanceTo(
                    this.#pointerState.clickStartPosition,
                );
                if (distanceTraveled <= MAX_DISTANCE_DURING_CLICK) {
                    this.#pointerState[button].clicked = true;
                }
            } else if (this.#pointerState[button].down) {
                this.#pointerState[button].downTime += deltaTime;
            }
        });

        const { position, worldPosition, ...restState } = this.#pointerState;
        this.#lastPointerState = {
            ...this.#lastPointerState,
            ...restState,
            [PointerButton.LEFT]: { ...this.#pointerState[PointerButton.LEFT] },
            [PointerButton.MIDDLE]: { ...this.#pointerState[PointerButton.MIDDLE] },
            [PointerButton.RIGHT]: { ...this.#pointerState[PointerButton.RIGHT] },
        };
        this.#lastPointerState.position.set(position);
        this.#lastPointerState.worldPosition.set(worldPosition);

        this.#updateAllPointerTargets();
        if (this._engine.options.cameraDrag) {
            this.#updateCameraDrag();
        }
        this.#updateCursor();
    }

    destroy(): void {
        this.#dragStartMousePosition = null;
        this.#dragStartCameraPosition = null;
    }

    getPointerTargetsWithinBox(bbox: BoundingBox): C_PointerTarget[] {
        return this._engine.trace('getPointerTargetsWithinBox', () => {
            const pointerTargets = this.#getAllPointerTargets();

            return pointerTargets.filter((target) => target.checkIfWithinBox(bbox));
        });
    }

    capturePointerButtonClick(button: PointerButton): void {
        this.#pointerState[button] = {
            ...this.#pointerState[button],
            clicked: false,
            released: false,
            pressed: false,
        };
    }

    requestCursor(id: string, type: CursorType, priority: number = 0): void {
        this.#cursorRequests.set(id, { type, priority });
    }

    #getAllPointerTargets(): C_PointerTarget[] {
        return this._engine.rootEntity.getComponentsInTree<C_PointerTarget>(C_PointerTarget.name);
    }

    #resetAllPointerTargets(): C_PointerTarget[] {
        const pointerTargets = this.#getAllPointerTargets();
        for (let i = pointerTargets.length - 1; i >= 0; i--) {
            const pointerTarget = pointerTargets[i];
            pointerTarget.isPointerHovered = false;
        }

        return pointerTargets;
    }

    #updateAllPointerTargets(): void {
        if (this.#checkForOverlap) {
            if (this.#pointerState.onScreen) {
                const pointerTargets = this.#resetAllPointerTargets();
                for (let i = pointerTargets.length - 1; i >= 0; i--) {
                    const pointerTarget = pointerTargets[i];
                    const isPointerOver = pointerTarget.checkIfPointerOver(
                        this.#pointerState.worldPosition,
                    );
                    if (isPointerOver) {
                        break;
                    }
                }
            } else if (this.#pointerState.justMovedOffScreen) {
                this.#resetAllPointerTargets();
            }
        } else {
            this.#resetAllPointerTargets();
        }

        if (this.#pointerState.justMovedOnScreen) {
            this.#pointerState.justMovedOnScreen = false;
        }
    }

    #updateCameraDrag(): void {
        if (this.#pointerState.scrollDelta !== 0) {
            const scrollMode = this._engine.options.cameraScrollMode;
            const meta = this._engine.getKey('Meta').down;
            if (
                scrollMode === 'all' ||
                (scrollMode === 'meta' && meta) ||
                (scrollMode === 'no-meta' && !meta)
            ) {
                this._engine.zoomCamera(
                    this.#pointerState.scrollDelta,
                    this.#pointerState.worldPosition,
                );
            }

            this.#accumulatedScrollDelta += this.#pointerState.scrollDelta;
            this.#scrollSteps = Math.trunc(this.#accumulatedScrollDelta / SCROLL_DELTA_PER_STEP);
            this.#accumulatedScrollDelta -= this.#scrollSteps * SCROLL_DELTA_PER_STEP;
            this.#pointerState.scrollDelta = 0;
        } else {
            this.#scrollSteps = 0;
        }

        const buttonStates = this._engine.options.cameraDragButtons.map(
            (btn) => this.#pointerState[btn],
        );
        if (buttonStates.some((state) => state.pressed) && !this.#dragStartMousePosition) {
            this.#dragStartMousePosition = this._engine.pointerState.position.extract();
            this.#dragStartCameraPosition = this._engine.camera.position;
        }

        if (this._engine.pointerState.justMoved) {
            if (
                buttonStates.some((state) => state.down) &&
                this.#dragStartMousePosition &&
                this.#dragStartCameraPosition
            ) {
                const screenDelta = this._engine.pointerState.position.sub(
                    this.#dragStartMousePosition,
                );
                this._engine.setCameraPosition(
                    new Vector(this.#dragStartCameraPosition).add(screenDelta),
                );
                this._engine.cameraTarget = null;
            }
        }

        if (buttonStates.some((state) => state.released) && this.#dragStartMousePosition) {
            this.#dragStartMousePosition = null;
            this.#dragStartCameraPosition = null;
        }

        if (this.#dragStartMousePosition) {
            this._engine.cameraTarget = null;
            this._engine.requestCursor('camera-drag', 'grabbing', DRAG_CURSOR_PRIORITY);
        }
    }

    #updateCursor(): void {
        let highestPriority = -Infinity;
        let selectedCursor: CursorType = 'default';

        for (const request of this.#cursorRequests.values()) {
            if (request.priority > highestPriority) {
                highestPriority = request.priority;
                selectedCursor = request.type;
            }
        }

        if (this.#currentCursor !== selectedCursor) {
            this.#currentCursor = selectedCursor;
            this.#applyCursor();
        }

        this.#cursorRequests.clear();
    }

    #applyCursor(): void {
        if (this.#canvas) {
            this.#canvas.style.cursor = this.#currentCursor;
        }
    }
}
