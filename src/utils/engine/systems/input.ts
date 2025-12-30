import { System } from '.';
import { Vector } from '../math';
import type { WebKey } from '../types';

interface KeyboardInput {
    type: 'key';
    key: WebKey;
    modifier?: boolean;
    shift?: boolean;
    alt?: boolean;
}

type Input = KeyboardInput;

interface ButtonConfig {
    type: 'button';
    inputs: Input[];
}

interface AxisConfig {
    type: 'axis';
    up?: Input[];
    down?: Input[];
    left?: Input[];
    right?: Input[];
}

export type InputConfig = ButtonConfig | AxisConfig;

export interface ButtonState {
    down: boolean;
    downAsNum: number;
    pressed: boolean;
    released: boolean;
    downTime: number;
    numHeldPresses: number;
}

const DEFAULT_BUTTON_STATE: ButtonState = {
    down: false,
    downAsNum: 0,
    pressed: false,
    released: false,
    downTime: 0,
    numHeldPresses: 0,
};

export interface KeyboardKeyState extends ButtonState {
    downWithoutModAsNum: number;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
    mod: boolean;
}

export interface AxisState {
    value: Vector;
    changed: boolean;
}

const DEFAULT_AXIS_STATE: AxisState = {
    value: new Vector(0),
    changed: false,
};

export class InputSystem extends System {
    #keyStates: Partial<
        Record<
            WebKey,
            {
                currState: KeyboardKeyState;
                prevState: KeyboardKeyState;
            }
        >
    > = {};

    #buttonStates: Record<
        string,
        {
            currState: ButtonState;
            prevState: ButtonState;
        }
    > = {};
    #buttonInputs: Record<string, KeyboardInput[]> = {};

    #axisStates: Record<
        string,
        {
            currState: AxisState;
            prevState: AxisState;
        }
    > = {};
    #axisToKeys: Record<string, Set<WebKey>> = {};
    #keyToAxesConfig: Partial<
        Record<
            WebKey,
            {
                name: string;
                up: boolean;
                down: boolean;
                left: boolean;
                right: boolean;
                modifier?: boolean;
                shift?: boolean;
                alt?: boolean;
            }[]
        >
    > = {};
    #keysPressedThisFrame: Set<WebKey> = new Set();

    override earlyUpdate(deltaTime: number) {
        // Update raw keyboard key state tracking
        for (const keyState of Object.values(this.#keyStates)) {
            this.#updateButtonState(keyState.currState, keyState.prevState, deltaTime);
        }

        // Recalculate button states from active keys
        for (const [button, inputs] of Object.entries(this.#buttonInputs)) {
            const buttonState = this.#buttonStates[button];
            if (!buttonState) continue;

            buttonState.prevState = { ...buttonState.currState };

            // Check if any input is satisfied (key is down and modifiers match)
            buttonState.currState.down = inputs.some((input) => {
                const keyState = this.#keyStates[input.key]?.currState;
                if (!keyState?.down) return false;

                // Check modifiers match - treat undefined as requiring false (modifier not pressed)
                const requiredMod = input.modifier ?? false;
                const requiredShift = input.shift ?? false;
                const requiredAlt = input.alt ?? false;

                if (keyState.mod !== requiredMod) return false;
                if (keyState.shift !== requiredShift) return false;
                if (keyState.alt !== requiredAlt) return false;

                return true;
            });
            buttonState.currState.downAsNum = buttonState.currState.down ? 1 : 0;
            this.#updateButtonState(buttonState.currState, buttonState.prevState, deltaTime);

            // Allow repeated presses while a modifier is held even if keyup is not delivered.
            const hadNewPress =
                buttonState.currState.down &&
                buttonState.prevState.down &&
                inputs.some((input) => this.#keysPressedThisFrame.has(input.key));
            if (hadNewPress) {
                buttonState.currState.pressed = true;
                buttonState.currState.numHeldPresses++;
            }
        }
        this.#keysPressedThisFrame.clear();

        // Recalculate axis states from active keys
        for (const [axis, keys] of Object.entries(this.#axisToKeys)) {
            const axisState = this.#axisStates[axis];
            if (!axisState) continue;

            axisState.prevState.changed = axisState.currState.changed;
            axisState.prevState.value.set(axisState.currState.value);

            // Collect all active directions for this axis
            let hasUp = false,
                hasDown = false,
                hasLeft = false,
                hasRight = false;
            for (const key of keys) {
                const keyState = this.#keyStates[key]?.currState;
                if (!keyState?.down) continue;

                const configs = (this.#keyToAxesConfig[key] || []).filter((c) => c.name === axis);
                for (const config of configs) {
                    // Check modifiers match - treat undefined as requiring false (modifier not pressed)
                    const requiredMod = config.modifier ?? false;
                    const requiredShift = config.shift ?? false;
                    const requiredAlt = config.alt ?? false;

                    if (keyState.mod !== requiredMod) continue;
                    if (keyState.shift !== requiredShift) continue;
                    if (keyState.alt !== requiredAlt) continue;

                    if (config.up) hasUp = true;
                    if (config.down) hasDown = true;
                    if (config.left) hasLeft = true;
                    if (config.right) hasRight = true;
                }
            }

            // Resolve conflicts: opposite directions cancel out
            axisState.currState.value.x = hasLeft && hasRight ? 0 : hasLeft ? -1 : hasRight ? 1 : 0;
            axisState.currState.value.y = hasUp && hasDown ? 0 : hasUp ? -1 : hasDown ? 1 : 0;
            this.#updateAxisState(axisState.currState, axisState.prevState);
        }
    }

    destroy(): void {
        this.#keyStates = {};
    }

    keyStateChange(
        key: WebKey,
        isDown: boolean,
        ctrl: boolean,
        meta: boolean,
        shift: boolean,
        alt: boolean,
    ): boolean {
        this.#setKeyStateIfNonExistent(key);

        const mod = ctrl || meta;
        const isModifierKey =
            key === 'Shift' || key === 'Meta' || key === 'Control' || key === 'Alt';
        const shouldForceReleaseNonModifiers = !isDown && (key === 'Meta' || key === 'Control');
        const keyCaptured = this._engine.options.keysToCapture?.some(
            (keyCapture) =>
                keyCapture.key === key &&
                (keyCapture.ctrl === undefined || keyCapture.ctrl === ctrl) &&
                (keyCapture.meta === undefined || keyCapture.meta === meta) &&
                (keyCapture.shift === undefined || keyCapture.shift === shift) &&
                (keyCapture.alt === undefined || keyCapture.alt === alt),
        );

        const effectiveDown = mod && !keyCaptured && !isModifierKey ? false : isDown;

        this.#keyStates[key]!.currState = {
            ...this.#keyStates[key]!.currState,
            down: effectiveDown,
            downAsNum: effectiveDown ? 1 : 0,
            downWithoutModAsNum: effectiveDown && !mod ? 1 : 0,
            ctrl,
            meta,
            shift,
            alt,
            mod: ctrl || meta,
        };
        if (mod) {
            this.#keyStates[key]!.prevState.down = false;
        }

        if (isDown) {
            this.#keysPressedThisFrame.add(key);
        }

        if (shouldForceReleaseNonModifiers) {
            this.#releaseNonModifierKeys();
        }

        return keyCaptured;
    }

    getKey(key: WebKey): KeyboardKeyState {
        this.#setKeyStateIfNonExistent(key);

        return this.#keyStates[key]!.currState;
    }

    releaseAllKeys(): void {
        for (const keyState of Object.values(this.#keyStates)) {
            const state = keyState.currState;
            state.down = false;
            state.downAsNum = 0;
            state.downWithoutModAsNum = 0;
        }
    }

    getButton(button: string): ButtonState {
        if (!(button in this.#buttonStates)) {
            console.warn(`Button ${button} not found`);
            return DEFAULT_BUTTON_STATE;
        }

        return this.#buttonStates[button]!.currState;
    }

    getAxis(axis: string): AxisState {
        if (!(axis in this.#axisStates)) {
            console.warn(`Axis ${axis} not found`);
            return DEFAULT_AXIS_STATE;
        }

        return this.#axisStates[axis]!.currState;
    }

    setInputConfigs(inputConfigs: Record<string, InputConfig>) {
        const newButtonInputs: Record<string, KeyboardInput[]> = {};
        const newAxisToKeys: Record<string, Set<WebKey>> = {};

        // Build configuration maps
        for (const [name, config] of Object.entries(inputConfigs)) {
            if (config.type === 'button') {
                newButtonInputs[name] = [];
                for (const input of config.inputs) {
                    if (input.type === 'key') {
                        newButtonInputs[name]!.push(input);
                    }
                }
            } else if (config.type === 'axis') {
                newAxisToKeys[name] = new Set();
                const directions = [
                    { inputs: config.up, up: true, down: false, left: false, right: false },
                    { inputs: config.down, up: false, down: true, left: false, right: false },
                    { inputs: config.left, up: false, down: false, left: true, right: false },
                    { inputs: config.right, up: false, down: false, left: false, right: true },
                ] as const;

                for (const { inputs = [], up, down, left, right } of directions) {
                    for (const input of inputs) {
                        this.#keyToAxesConfig[input.key] ??= [];
                        this.#keyToAxesConfig[input.key]!.push({
                            name,
                            up,
                            down,
                            left,
                            right,
                            modifier: input.modifier,
                            shift: input.shift,
                            alt: input.alt,
                        });
                        newAxisToKeys[name]!.add(input.key);
                    }
                }
            }
        }

        // Clean up old button/axis states not in new config
        for (const button of Object.keys(this.#buttonStates)) {
            const config = inputConfigs[button];
            if (!config || config.type !== 'button') {
                delete this.#buttonStates[button];
            }
        }
        for (const axis of Object.keys(this.#axisStates)) {
            const config = inputConfigs[axis];
            if (!config || config.type !== 'axis') {
                delete this.#axisStates[axis];
            }
        }

        // Create new button/axis states
        for (const [name, config] of Object.entries(inputConfigs)) {
            if (config.type === 'button' && !(name in this.#buttonStates)) {
                this.#buttonStates[name] = {
                    currState: { ...DEFAULT_BUTTON_STATE },
                    prevState: { ...DEFAULT_BUTTON_STATE },
                };
            } else if (config.type === 'axis' && !(name in this.#axisStates)) {
                this.#axisStates[name] = {
                    currState: {
                        changed: false,
                        value: new Vector(0),
                    },
                    prevState: {
                        changed: false,
                        value: new Vector(0),
                    },
                };
            }
        }

        // Update maps
        this.#buttonInputs = newButtonInputs;
        this.#axisToKeys = newAxisToKeys;
    }

    #releaseNonModifierKeys() {
        for (const [key, keyState] of Object.entries(this.#keyStates)) {
            if (!keyState) continue;
            const isModifier =
                key === 'Shift' || key === 'Meta' || key === 'Control' || key === 'Alt';
            if (isModifier) continue;

            keyState.currState.down = false;
            keyState.currState.downAsNum = 0;
            keyState.currState.downWithoutModAsNum = 0;
        }
    }

    #setKeyStateIfNonExistent(key: WebKey) {
        if (!(key in this.#keyStates)) {
            const state: KeyboardKeyState = {
                down: false,
                downAsNum: 0,
                downWithoutModAsNum: 0,
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

    #updateButtonState(
        currButtonState: ButtonState,
        prevButtonState: ButtonState,
        deltaTime: number,
    ) {
        currButtonState.pressed = !prevButtonState.down && currButtonState.down;
        currButtonState.released = prevButtonState.down && !currButtonState.down;
        if (currButtonState.pressed) {
            currButtonState.numHeldPresses++;
        }

        if (currButtonState.down) {
            currButtonState.downTime += deltaTime;
        } else {
            currButtonState.downTime = 0;
            currButtonState.numHeldPresses = 0;
        }
    }

    #updateAxisState(currAxisState: AxisState, prevAxisState: AxisState) {
        currAxisState.changed = !currAxisState.value.equals(prevAxisState.value);
    }
}
