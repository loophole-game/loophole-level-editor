import { System } from '.';
import type { ButtonState } from '../types';

export interface KeyboardKeyState extends ButtonState {
    numHeldPresses: number;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
    mod: boolean;
}

interface KeyState {
    currState: KeyboardKeyState;
    prevState: KeyboardKeyState;
}

export class KeyboardSystem extends System {
    #keyStates: Record<string, KeyState> = {};

    update(deltaTime: number): boolean {
        for (const key in this.#keyStates) {
            const keyState = this.#keyStates[key];
            keyState.currState.pressed = !keyState.prevState.down && keyState.currState.down;
            keyState.currState.released = keyState.prevState.down && !keyState.currState.down;
            if (keyState.currState.pressed) {
                keyState.currState.numHeldPresses++;
            }

            if (keyState.currState.down) {
                keyState.currState.downTime += deltaTime;
            } else {
                keyState.currState.downTime = 0;
                keyState.currState.numHeldPresses = 0;
            }

            keyState.prevState = { ...keyState.currState };
        }

        return false;
    }

    destroy(): void {
        this.#keyStates = {};
    }

    keyStateChange(
        key: string,
        isDown: boolean,
        ctrl: boolean,
        meta: boolean,
        shift: boolean,
        alt: boolean,
    ): boolean {
        this.#setIfNonExistent(key);

        const mod = ctrl || meta;
        this.#keyStates[key].currState = {
            ...this.#keyStates[key].currState,
            down: isDown,
            downAsNum: isDown ? 1 : 0,
            ctrl,
            meta,
            shift,
            alt,
            mod: ctrl || meta,
        };
        if (mod) {
            this.#keyStates[key].prevState.down = false;
        }

        const keyCaptured = this._engine.options.keysToCapture?.some(
            (keyCapture) =>
                keyCapture.key === key &&
                (keyCapture.ctrl === undefined || keyCapture.ctrl === ctrl) &&
                (keyCapture.meta === undefined || keyCapture.meta === meta) &&
                (keyCapture.shift === undefined || keyCapture.shift === shift) &&
                (keyCapture.alt === undefined || keyCapture.alt === alt),
        );
        return keyCaptured;
    }

    getKey(key: string): KeyboardKeyState {
        this.#setIfNonExistent(key);

        return this.#keyStates[key].currState;
    }

    #setIfNonExistent(key: string) {
        if (!(key in this.#keyStates)) {
            const state: KeyboardKeyState = {
                down: false,
                downAsNum: 0,
                pressed: false,
                released: false,
                downTime: 0,
                numHeldPresses: 0,
                ctrl: false,
                meta: false,
                shift: false,
                alt: false,
                mod: false,
            };
            this.#keyStates[key] = {
                currState: { ...state },
                prevState: state,
            };
        }
    }
}
