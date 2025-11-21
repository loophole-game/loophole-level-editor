import { System } from '.';
import { C_PointerTarget } from '../components/PointerTarget';
import { type ButtonState, type Position } from '../types';

const MAX_DISTANCE_DURING_CLICK = 10;

export interface PointerButtonState extends ButtonState {
    clicked: boolean;
}

export const PointerButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
} as const;
export type PointerButton = (typeof PointerButton)[keyof typeof PointerButton];

export interface PointerState extends Position, Record<PointerButton, PointerButtonState> {
    scrollDelta: number;
    justMoved: boolean;
    onScreen: boolean;
    justMovedOnScreen: boolean;
    justMovedOffScreen: boolean;
    worldPosition: Position;
    clickStartPosition: Position | null;
    clickEndPosition: Position | null;
}

export class PointerSystem extends System {
    #pointerState: PointerState = {
        scrollDelta: 0,
        justMoved: false,
        x: 0,
        y: 0,
        worldPosition: { x: 0, y: 0 },
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
        },
        [PointerButton.MIDDLE]: {
            down: false,
            downAsNum: 0,
            pressed: false,
            released: false,
            clicked: false,
            downTime: 0,
        },
        [PointerButton.RIGHT]: {
            down: false,
            downAsNum: 0,
            pressed: false,
            released: false,
            clicked: false,
            downTime: 0,
        },
    };
    #lastPointerState: PointerState = { ...this.#pointerState };

    #dragStartMousePosition: Position | null = null;
    #dragStartCameraPosition: Position | null = null;

    #checkForOverlap: boolean = true;

    get pointerState(): Readonly<PointerState> {
        return this.#pointerState;
    }

    get pointerPosition(): Readonly<Position> {
        return {
            x: this.#pointerState.x,
            y: this.#pointerState.y,
        };
    }

    set pointerPosition(position: Position) {
        this.#pointerState.x = position.x;
        this.#pointerState.y = position.y;
        this.#pointerState.justMovedOnScreen = !this.#pointerState.onScreen;
        this.#pointerState.justMovedOffScreen = false;
        this.#pointerState.justMoved = true;
        this.#pointerState.onScreen = true;
    }

    set pointerScrollDelta(delta: number) {
        this.#pointerState.scrollDelta = delta;
    }

    get pointerWorldPosition(): Readonly<Position> {
        return {
            x: this.#pointerState.worldPosition.x,
            y: this.#pointerState.worldPosition.y,
        };
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

    getPointerButton(button: PointerButton): PointerButtonState {
        return this.#pointerState[button];
    }

    pointerButtonStateChange(button: PointerButton, down: boolean) {
        this.#pointerState[button] = {
            ...this.#pointerState[button],
            down,
            downAsNum: down ? 1 : 0,
            downTime: 0,
        };
        const position = { x: this.#pointerState.x, y: this.#pointerState.y };
        if (down) {
            this.#pointerState.clickStartPosition = position;
            this.#pointerState.clickEndPosition = null;
        } else {
            this.#pointerState.clickEndPosition = position;
        }
    }

    update(deltaTime: number): boolean {
        this.#pointerState.justMoved =
            this.#pointerState.x !== this.#lastPointerState.x ||
            this.#pointerState.y !== this.#lastPointerState.y;
        this.#pointerState.worldPosition = this._engine.screenToWorld(this.#pointerState);
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
                const distanceTraveled = Math.hypot(
                    this.#pointerState.clickEndPosition.x - this.#pointerState.clickStartPosition.x,
                    this.#pointerState.clickEndPosition.y - this.#pointerState.clickStartPosition.y,
                );
                if (distanceTraveled <= MAX_DISTANCE_DURING_CLICK) {
                    this.#pointerState[button].clicked = true;
                }
            } else if (this.#pointerState[button].down) {
                this.#pointerState[button].downTime += deltaTime;
            }
        });

        this.#lastPointerState = {
            ...this.#pointerState,
            [PointerButton.LEFT]: { ...this.#pointerState[PointerButton.LEFT] },
            [PointerButton.MIDDLE]: { ...this.#pointerState[PointerButton.MIDDLE] },
            [PointerButton.RIGHT]: { ...this.#pointerState[PointerButton.RIGHT] },
        };

        this.#updateAllPointerTargets();

        if (this.#pointerState.justMovedOnScreen) {
            this.#pointerState.justMovedOnScreen = false;
        }

        if (this._engine.options.cameraDrag) {
            if (this.#pointerState.scrollDelta !== 0) {
                this._engine.zoomCamera(
                    this.#pointerState.scrollDelta,
                    this.#pointerState.worldPosition,
                );
                this.#pointerState.scrollDelta = 0;
                this._engine.cameraTarget = null;
            }

            const buttonStates = this._engine.options.cameraDragButtons.map(
                (btn) => this.#pointerState[btn],
            );
            if (buttonStates.some((state) => state.pressed) && !this.#dragStartMousePosition) {
                this.#dragStartMousePosition = { ...this._engine.pointerState };
                this.#dragStartCameraPosition = { ...this._engine.camera.position };
                this._engine.requestCursor('camera-drag', 'grabbing', 40); // CURSOR_PRIORITY.CAMERA_DRAG
            }

            if (this._engine.pointerState.justMoved) {
                if (
                    buttonStates.some((state) => state.down) &&
                    this.#dragStartMousePosition &&
                    this.#dragStartCameraPosition
                ) {
                    const screenDelta = {
                        x: this._engine.pointerState.x - this.#dragStartMousePosition.x,
                        y: this._engine.pointerState.y - this.#dragStartMousePosition.y,
                    };
                    this._engine.setCameraPosition({
                        x: this.#dragStartCameraPosition.x + screenDelta.x,
                        y: this.#dragStartCameraPosition.y + screenDelta.y,
                    });
                    this._engine.cameraTarget = null;
                }
            }

            if (buttonStates.some((state) => state.released) && this.#dragStartMousePosition) {
                this.#dragStartMousePosition = null;
                this.#dragStartCameraPosition = null;
                this._engine.cancelCursorRequest('camera-drag');
            }

            if (this.#dragStartMousePosition) {
                this._engine.cameraTarget = null;
            }
        }

        return false;
    }

    destroy(): void {
        this.#dragStartMousePosition = null;
        this.#dragStartCameraPosition = null;
    }

    getPointerTargetsWithinBox(topLeft: Position, bottomRight: Position): C_PointerTarget[] {
        const pointerTargets = this.#getAllPointerTargets();

        return pointerTargets.filter((target) => target.checkIfWithinBox(topLeft, bottomRight));
    }

    capturePointerButtonClick(button: PointerButton): void {
        this.#pointerState[button] = {
            ...this.#pointerState[button],
            clicked: false,
            released: false,
            pressed: false,
        };
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
    }
}
