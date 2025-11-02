import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { PointerButton } from '../../engine/systems/pointer';
import { Scene } from '../../engine/systems/scene';
import { type Position } from '../../engine/types';

const NUM_BOXES = 50;

export class TestScene extends Scene {
    #rotatingBox: Entity | null = null;

    override create() {
        this.#rotatingBox = this.#generateNestedBoxes(NUM_BOXES, [{ x: 0, y: 0 }])
            .setScale({ x: 200, y: 200 })
            .rotate(45)
            .addEntities(
                new Entity('Top Left', new C_Shape('Dot', 'ELLIPSE', { fillStyle: 'yellow' }))
                    .setScale({ x: 0.25, y: 0.25 })
                    .setPosition({ x: -0.5, y: -0.5 }),
                new Entity('Top Right', new C_Shape('Dot', 'ELLIPSE', { fillStyle: 'green' }))
                    .setScale({ x: 0.25, y: 0.25 })
                    .setPosition({ x: 0.5, y: -0.5 }),
                new Entity('Bottom Left', new C_Shape('Dot', 'ELLIPSE', { fillStyle: 'blue' }))
                    .setScale({ x: 0.25, y: 0.25 })
                    .setPosition({ x: -0.5, y: 0.5 }),
                new Entity('Bottom Right', new C_Shape('Dot', 'ELLIPSE', { fillStyle: 'purple' }))
                    .setScale({ x: 0.25, y: 0.25 })
                    .setPosition({ x: 0.5, y: 0.5 }),
                new Entity('Center Behind', new C_Shape('Dot', 'ELLIPSE', { fillStyle: 'orange' }))
                    .setZIndex(-1)
                    .setScale({ x: 1.25, y: 1.25 }),
                new Entity(
                    'Center Above',
                    new C_Shape('Dot', 'ELLIPSE', { fillStyle: 'white' }),
                ).setScale({ x: 0.02, y: 0.02 }),
            );
        this.addEntities(this.#rotatingBox);

        this.addEntities(
            this.#generateNestedBoxes(NUM_BOXES, [{ x: 0.25, y: 0.25 }])
                .setPosition({
                    x: -400,
                    y: -400,
                })
                .setScale({ x: 300, y: 300 }),
            this.#generateNestedBoxes(NUM_BOXES, [{ x: -0.25, y: 0.25 }])
                .setPosition({
                    x: 400,
                    y: -400,
                })
                .setScale({ x: 300, y: 300 }),
            this.#generateNestedBoxes(NUM_BOXES, [{ x: 0.25, y: -0.25 }])
                .setPosition({
                    x: -400,
                    y: 400,
                })
                .setScale({ x: 300, y: 300 }),
            this.#generateNestedBoxes(NUM_BOXES, [{ x: -0.25, y: -0.25 }])
                .setPosition({
                    x: 400,
                    y: 400,
                })
                .setScale({ x: 300, y: 300 }),
        );
    }

    #generateNestedBoxes(count: number, pattern: Position[]): Entity {
        let currEntity: Entity | null = null;
        let root: Entity | null = null;
        for (let i = 0; i < count; i++) {
            const frame = pattern[i % pattern.length];
            const entity = new Entity(
                `Nested Box Level ${i + 1}`,
                new C_Shape(`Box Level ${i + 1}`, 'RECT', {
                    fillStyle: `hsl(${(i * 40) % 360}, 70%, 50%)`,
                    lineWidth: 0.1,
                }),
            )
                .setScale({ x: 0.75, y: 0.75 })
                .setPosition(frame)
                .rotate(12 * (i % 2 === 0 ? 1 : -1));
            if (!currEntity) {
                root = entity;
            } else {
                currEntity.addEntities(entity);
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
