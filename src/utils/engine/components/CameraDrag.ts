import { Component } from '.';
import { MouseButton } from '../systems/pointer';
import { type Position } from '../types';

export class C_CameraDrag extends Component {
    #mouseButtons: MouseButton[] = [];

    #dragStartMousePosition: Position | null = null;
    #dragStartCameraPosition: Position | null = null;

    constructor(...mouseButtons: MouseButton[]) {
        super('Camera Drag');
        this.#mouseButtons = mouseButtons.length > 0 ? mouseButtons : [MouseButton.MIDDLE];
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);

        const buttonStates = this.#mouseButtons.map((btn) => window.engine.pointerState[btn]);
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

            updated = true;
        }

        if (buttonStates.some((state) => state.released) && this.#dragStartMousePosition) {
            this.#dragStartMousePosition = null;
            this.#dragStartCameraPosition = null;
        }

        return updated;
    }
}
