import type { Engine } from '..';
import { C_PointerTarget } from '../components/PointerTarget';
import { type Position } from '../types';

export interface MouseButtonState {
    down: boolean;
    pressed: boolean;
    released: boolean;
}

export const MouseButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
} as const;
export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];

export interface MouseState extends Position, Record<MouseButton, MouseButtonState> {
    justMoved: boolean;
    onScreen: boolean;
    worldX: number;
    worldY: number;
}

export class PointerSystem {
    #engine: Engine;

    #mouseState: MouseState = {
        justMoved: false,
        x: 0,
        y: 0,
        worldX: 0,
        worldY: 0,
        onScreen: false,
        [MouseButton.LEFT]: { down: false, pressed: false, released: false },
        [MouseButton.MIDDLE]: { down: false, pressed: false, released: false },
        [MouseButton.RIGHT]: { down: false, pressed: false, released: false },
    };
    #lastMouseState: MouseState = { ...this.#mouseState };

    constructor(engine: Engine) {
        this.#engine = engine;
    }

    get mouseState(): MouseState {
        return this.#mouseState;
    }

    get mousePosition(): Readonly<Position> {
        return {
            x: this.#mouseState.x,
            y: this.#mouseState.y,
        };
    }

    set mousePosition(position: Position) {
        this.#mouseState.x = position.x;
        this.#mouseState.y = position.y;
        this.#mouseState.justMoved = true;
        this.#mouseState.onScreen = true;
    }

    get mouseWorldPosition(): Readonly<Position> {
        return {
            x: this.#mouseState.worldX,
            y: this.#mouseState.worldY,
        };
    }

    get mouseOnScreen(): boolean {
        return this.#mouseState.onScreen;
    }

    set mouseOnScreen(onScreen: boolean) {
        this.#mouseState.onScreen = onScreen;
    }

    getMouseButton(button: MouseButton): MouseButtonState {
        return this.#mouseState[button];
    }

    setMouseButton(button: MouseButton, state: Partial<MouseButtonState>) {
        this.#mouseState[button] = { ...this.#mouseState[button], ...state };
    }

    update(): void {
        this.#mouseState.justMoved =
            this.#mouseState.x !== this.#lastMouseState.x ||
            this.#mouseState.y !== this.#lastMouseState.y;
        Object.values(MouseButton).forEach((button: MouseButton) => {
            this.#mouseState[button].pressed =
                this.#mouseState[button].down && !this.#lastMouseState[button].down;
            this.#mouseState[button].released =
                !this.#mouseState[button].down && this.#lastMouseState[button].down;
        });

        this.#lastMouseState = {
            ...this.#mouseState,
            [MouseButton.LEFT]: { ...this.#mouseState[MouseButton.LEFT] },
            [MouseButton.MIDDLE]: { ...this.#mouseState[MouseButton.MIDDLE] },
            [MouseButton.RIGHT]: { ...this.#mouseState[MouseButton.RIGHT] },
        };

        if (this.#mouseState.onScreen) {
            const pointerTargets = this.#engine.rootEntity.getComponentsInTree<C_PointerTarget>(
                C_PointerTarget.name,
            );
            const pointerWorldPosition = this.#engine.screenToWorld(this.#mouseState);
            for (const pointerTarget of pointerTargets) {
                const isPointerOver = pointerTarget.checkIfPointerOver(pointerWorldPosition);
                if (isPointerOver) {
                    break;
                }
            }
        }
    }
}
