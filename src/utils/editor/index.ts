import { Engine } from '../engine';
import { ShapeComponent } from '../engine/components/ShapeComponent';
import { Entity } from '../engine/entities';
import type { Position } from '../levelSchema';

class Cursor extends Entity {
    #shapeComp: ShapeComponent;
    #opacity: number = 0;

    #dragStartMousePosition: Position | null = null;
    #dragStartCameraPosition: Position | null = null;

    constructor() {
        const comp = new ShapeComponent('cursor', 'ELLIPSE', {
            fillStyle: 'blue',
            strokeStyle: 'white',
            lineWidth: 2,
            globalAlpha: 0,
        });

        super('cursor', [comp]);

        this.#shapeComp = comp;
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);

        if (window.engine.mouseState.middlePressed && !this.#dragStartMousePosition) {
            this.#dragStartMousePosition = { ...window.engine.mouseState };
            this.#dragStartCameraPosition = { ...window.engine.camera.position };
        }

        if (
            window.engine.mouseState.x != this._position.x ||
            window.engine.mouseState.y != this._position.y
        ) {
            this.setPosition(window.engine.mouseToWorld(window.engine.mouseState));

            if (
                window.engine.mouseState.middleDown &&
                this.#dragStartMousePosition &&
                this.#dragStartCameraPosition
            ) {
                const mouseDelta = {
                    x: this.#dragStartMousePosition.x - window.engine.mouseState.x,
                    y: this.#dragStartMousePosition.y - window.engine.mouseState.y,
                };
                const worldDelta = window.engine.mouseToWorld(mouseDelta, true);
                window.engine.setCameraPosition({
                    x: this.#dragStartCameraPosition.x - worldDelta.x,
                    y: this.#dragStartCameraPosition.y - worldDelta.y,
                });
            }

            updated = true;
        }

        if (window.engine.mouseState.middleReleased && this.#dragStartMousePosition) {
            this.#dragStartMousePosition = null;
            this.#dragStartCameraPosition = null;
        }

        const active = window.engine.mouseState.onScreen;
        const targetOpacity = active ? 1 : 0;
        if (this.#opacity !== targetOpacity) {
            this.#opacity = Math.max(
                0,
                Math.min(
                    1,
                    this.#opacity +
                        (targetOpacity - this.#opacity) * deltaTime * (active ? 10 : 20),
                ),
            );
            this.#shapeComp.style.globalAlpha = this.#opacity;
            updated = true;
        }

        return updated;
    }
}

export class Editor extends Engine {
    constructor() {
        super();

        for (let i = 0; i < 100; i++) {
            this.addEntities(
                new Entity('test', [
                    new ShapeComponent('test', 'RECT', {
                        fillStyle: 'red',
                    }),
                ])
                    .translate({ x: 150 + i * 10, y: 50 + i * 10 })
                    .scale({ x: 100, y: 100 })
                    .rotate(45)
                    .addChildren(
                        new Entity('test', [
                            new ShapeComponent('test', 'ELLIPSE', {
                                fillStyle: 'blue',
                                globalAlpha: 0.05,
                            }),
                        ])
                            .translate({ x: 2, y: 1 })
                            .scale({ x: 0.5, y: 0.5 }),
                    ),
            );
        }
        this.addEntities(new Cursor().scale({ x: 8, y: 8 }));
    }
}
