import type { Engine } from '..';
import { C_PointerTarget } from '../components/PointerTarget';
import { type Position } from '../types';

const MAX_DISTANCE_DURING_CLICK = 10;

export interface MouseButtonState {
    down: boolean;
    pressed: boolean;
    released: boolean;
    clicked: boolean;
}

export const MouseButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
} as const;
export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];

export interface PointerState extends Position, Record<MouseButton, MouseButtonState> {
    scrollDelta: number;
    justMoved: boolean;
    onScreen: boolean;
    justMovedOnScreen: boolean;
    justMovedOffScreen: boolean;
    worldPosition: Position;
    clickTime: number;
    clickStartPosition: Position | null;
    clickEndPosition: Position | null;
}

export class PointerSystem {
    #engine: Engine;

    #pointerState: PointerState = {
        scrollDelta: 0,
        justMoved: false,
        x: 0,
        y: 0,
        worldPosition: { x: 0, y: 0 },
        clickTime: 0,
        clickStartPosition: null,
        clickEndPosition: null,
        onScreen: false,
        justMovedOnScreen: false,
        justMovedOffScreen: false,
        [MouseButton.LEFT]: { down: false, pressed: false, released: false, clicked: false },
        [MouseButton.MIDDLE]: { down: false, pressed: false, released: false, clicked: false },
        [MouseButton.RIGHT]: { down: false, pressed: false, released: false, clicked: false },
    };
    #lastPointerState: PointerState = { ...this.#pointerState };

    #dragStartMousePosition: Position | null = null;
    #dragStartCameraPosition: Position | null = null;

    constructor(engine: Engine) {
        this.#engine = engine;
    }

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

    getPointerButton(button: MouseButton): MouseButtonState {
        return this.#pointerState[button];
    }

    pointerButtonStateChange(button: MouseButton, down: boolean) {
        this.#pointerState[button] = { ...this.#pointerState[button], down };
        const position = { x: this.#pointerState.x, y: this.#pointerState.y };
        if (down) {
            this.#pointerState.clickStartPosition = position;
            this.#pointerState.clickEndPosition = null;
            this.#pointerState.clickTime = 0;
        } else {
            this.#pointerState.clickEndPosition = position;
        }
    }

    update(deltaTime: number): void {
        this.#pointerState.justMoved =
            this.#pointerState.x !== this.#lastPointerState.x ||
            this.#pointerState.y !== this.#lastPointerState.y;
        this.#pointerState.worldPosition = this.#engine.screenToWorld(this.#pointerState);
        Object.values(MouseButton).forEach((button: MouseButton) => {
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
                const distanceTravelled = Math.hypot(
                    this.#pointerState.clickEndPosition.x - this.#pointerState.clickStartPosition.x,
                    this.#pointerState.clickEndPosition.y - this.#pointerState.clickStartPosition.y,
                );
                if (distanceTravelled <= MAX_DISTANCE_DURING_CLICK) {
                    this.#pointerState[button].clicked = true;
                }
            } else if (this.#pointerState[button].down) {
                this.#pointerState.clickTime += deltaTime;
            }
        });

        this.#lastPointerState = {
            ...this.#pointerState,
            [MouseButton.LEFT]: { ...this.#pointerState[MouseButton.LEFT] },
            [MouseButton.MIDDLE]: { ...this.#pointerState[MouseButton.MIDDLE] },
            [MouseButton.RIGHT]: { ...this.#pointerState[MouseButton.RIGHT] },
        };

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

        if (this.#pointerState.justMovedOnScreen) {
            this.#pointerState.justMovedOnScreen = false;
        }

        if (this.#engine.options.cameraDrag) {
            const buttonStates = this.#engine.options.cameraDragButtons.map(
                (btn) => this.#pointerState[btn],
            );
            if (buttonStates.some((state) => state.pressed) && !this.#dragStartMousePosition) {
                this.#dragStartMousePosition = { ...window.engine.pointerState };
                this.#dragStartCameraPosition = { ...window.engine.camera.position };
            }

            if (window.engine.pointerState.justMoved) {
                if (
                    buttonStates.some((state) => state.down) &&
                    this.#dragStartMousePosition &&
                    this.#dragStartCameraPosition
                ) {
                    const screenDelta = {
                        x: window.engine.pointerState.x - this.#dragStartMousePosition.x,
                        y: window.engine.pointerState.y - this.#dragStartMousePosition.y,
                    };
                    window.engine.setCameraPosition({
                        x: this.#dragStartCameraPosition.x + screenDelta.x,
                        y: this.#dragStartCameraPosition.y + screenDelta.y,
                    });
                }
            }

            if (buttonStates.some((state) => state.released) && this.#dragStartMousePosition) {
                this.#dragStartMousePosition = null;
                this.#dragStartCameraPosition = null;
            }

            if (this.#pointerState.scrollDelta !== 0) {
                window.engine.zoomCamera(this.#pointerState.scrollDelta);
                this.#pointerState.scrollDelta = 0;
            }
        }
    }

    #resetAllPointerTargets(): C_PointerTarget[] {
        const pointerTargets = this.#engine.rootEntity.getComponentsInTree<C_PointerTarget>(
            C_PointerTarget.name,
        );
        for (let i = pointerTargets.length - 1; i >= 0; i--) {
            const pointerTarget = pointerTargets[i];
            pointerTarget.isPointerOver = false;
        }

        return pointerTargets;
    }
}
