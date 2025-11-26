import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { PointerButton } from '../../engine/systems/pointer';
import { Scene } from '../../engine/systems/scene';
import type { Engine } from '../../engine';
import type { IVector } from '@/utils/engine/math';

const NUM_BOXES = 50;

export class TestScene extends Scene {
    #rotatingBox: Entity | null = null;

    override create(engine: Engine) {
        this.#rotatingBox = this.#generateNestedBoxes(NUM_BOXES, [{ x: 0, y: 0 }], engine)
            .setScale({ x: 200, y: 200 })
            .rotate(45);
        this.#rotatingBox.add(
            Entity,
            {
                name: 'Top Left',
                scale: 0.25,
                position: { x: -0.5, y: -0.5 },
                components: [
                    engine.addComponent(C_Shape, {
                        name: 'Dot',
                        shape: 'ELLIPSE',
                        style: { fillStyle: 'yellow' },
                    }),
                ],
            },
            {
                name: 'Top Right',
                scale: 0.25,
                position: { x: 0.5, y: -0.5 },
                components: [
                    engine.addComponent(C_Shape, {
                        name: 'Dot',
                        shape: 'ELLIPSE',
                        style: { fillStyle: 'green' },
                    }),
                ],
            },
            {
                name: 'Bottom Left',
                scale: 0.25,
                position: { x: -0.5, y: 0.5 },
                components: [
                    engine.addComponent(C_Shape, {
                        name: 'Dot',
                        shape: 'ELLIPSE',
                        style: { fillStyle: 'blue' },
                    }),
                ],
            },
            {
                name: 'Bottom Right',
                scale: 0.25,
                position: 0.5,
                components: [
                    engine.addComponent(C_Shape, {
                        name: 'Dot',
                        shape: 'ELLIPSE',
                        style: { fillStyle: 'purple' },
                    }),
                ],
            },
            {
                name: 'Center Behind',
                scale: 1.25,
                zIndex: -1,
                components: [
                    engine.addComponent(C_Shape, {
                        name: 'Dot',
                        shape: 'ELLIPSE',
                        style: { fillStyle: 'orange' },
                    }),
                ],
            },
            {
                name: 'Center Above',
                scale: 0.02,
                components: [
                    engine.addComponent(C_Shape, {
                        name: 'Dot',
                        shape: 'ELLIPSE',
                        style: { fillStyle: 'white' },
                    }),
                ],
            },
        );

        this.#generateNestedBoxes(NUM_BOXES, [{ x: 0.25, y: 0.25 }], engine)
            .setPosition({
                x: -400,
                y: -400,
            })
            .setScale({ x: 300, y: 300 });
        this.#generateNestedBoxes(NUM_BOXES, [{ x: -0.25, y: 0.25 }], engine)
            .setPosition({
                x: 400,
                y: -400,
            })
            .setScale({ x: 300, y: 300 });
        this.#generateNestedBoxes(NUM_BOXES, [{ x: 0.25, y: -0.25 }], engine)
            .setPosition({
                x: -400,
                y: 400,
            })
            .setScale({ x: 300, y: 300 });
        this.#generateNestedBoxes(NUM_BOXES, [{ x: -0.25, y: -0.25 }], engine)
            .setPosition({
                x: 400,
                y: 400,
            })
            .setScale({ x: 300, y: 300 });
    }

    #generateNestedBoxes(count: number, pattern: IVector<number>[], engine: Engine): Entity {
        let currEntity: Entity | null = null;
        let root: Entity | null = null;
        for (let i = 0; i < count; i++) {
            const frame = pattern[i % pattern.length];
            const entity = (currEntity || engine)
                .add(Entity, {
                    name: `Nested Box Level ${i + 1}`,
                    components: [
                        engine.addComponent(C_Shape, {
                            name: `Box Level ${i + 1}`,
                            shape: 'RECT',
                            style: {
                                fillStyle: `hsl(${(i * 40) % 360}, 70%, 50%)`,
                                lineWidth: 0.1,
                            },
                        }),
                    ],
                    scene: this.name,
                })
                .setScale({ x: 0.75, y: 0.75 })
                .setPosition(frame)
                .rotate(12 * (i % 2 === 0 ? 1 : -1));
            if (!currEntity) {
                root = entity;
            }

            currEntity = entity;
        }

        return root!;
    }

    override update(deltaTime: number): boolean {
        this.#rotatingBox?.rotate(90 * deltaTime);

        if (window.engine?.pointerState[PointerButton.LEFT].pressed) {
            window.engine.destroyScene(this._id);
        }

        return true;
    }
}
