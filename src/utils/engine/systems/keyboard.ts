import { System } from '.';
import type { ButtonState } from '../types';

export interface KeyboardKeyState extends ButtonState {
    numHeldPresses: number;
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

    keyStateChange(key: string, isDown: boolean): void {
        this.#setIfNonExistent(key);

        this.#keyStates[key].currState = {
            ...this.#keyStates[key].currState,
            down: isDown,
            downAsNum: isDown ? 1 : 0,
        };
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
            };
            this.#keyStates[key] = {
                currState: { ...state },
                prevState: state,
            };
        }
    }
}
