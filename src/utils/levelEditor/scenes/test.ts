import { C_Text } from '@/utils/engine/components/Text';
import { C_Shape } from '../../engine/components/Shape';
import { Entity, type EntityOptions } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import type { IVector } from '@/utils/engine/math';
import type { TwoAxisAlignment } from '@/utils/engine/types';

const NUM_BOXES = 50;

export class TestScene extends Scene {
    #rotatingBox: Entity | null = null;

    override create() {
        this.#rotatingBox = this.#generateNestedBoxes(NUM_BOXES, [{ x: 0, y: 0 }])
            .setScale({ x: 200, y: 200 })
            .rotate(45);
        this.#rotatingBox.addEntities(
            Entity,
            {
                name: 'Top Left',
                scale: 0.25,
                position: { x: -0.5, y: -0.5 },
                components: [],
            },
            {
                name: 'Top Right',
                scale: 0.25,
                position: { x: 0.5, y: -0.5 },
                components: [],
            },
            {
                name: 'Bottom Left',
                scale: 0.25,
                position: { x: -0.5, y: 0.5 },
                components: [],
            },
            {
                name: 'Bottom Right',
                scale: 0.25,
                position: 0.5,
                components: [],
            },
            {
                name: 'Center Behind',
                scale: 1.25,
                zIndex: -1,
                components: [],
            },
            {
                name: 'Center Above',
                scale: 0.02,
                components: [],
            },
        );

        this.#generateNestedBoxes(NUM_BOXES, [{ x: 0.25, y: 0.25 }])
            .setPosition({
                x: -400,
                y: -400,
            })
            .setScale({ x: 300, y: 300 });
        this.#generateNestedBoxes(NUM_BOXES, [{ x: -0.25, y: 0.25 }])
            .setPosition({
                x: 400,
                y: -400,
            })
            .setScale({ x: 300, y: 300 });
        this.#generateNestedBoxes(NUM_BOXES, [{ x: 0.25, y: -0.25 }])
            .setPosition({
                x: -400,
                y: 400,
            })
            .setScale({ x: 300, y: 300 });
        this.#generateNestedBoxes(NUM_BOXES, [{ x: -0.25, y: -0.25 }])
            .setPosition({
                x: 400,
                y: 400,
            })
            .setScale({ x: 300, y: 300 });

        this.#loadTextAlignmentTest();
    }

    override update(deltaTime: number): boolean {
        this.#rotatingBox?.rotate(90 * deltaTime);

        return true;
    }

    #generateNestedBoxes(count: number, pattern: IVector<number>[]): Entity {
        let currEntity: Entity | null = null;
        let root: Entity | null = null;
        for (let i = 0; i < count; i++) {
            const frame = pattern[i % pattern.length];
            const entityOptions: Omit<EntityOptions, 'engine'> = {
                name: `Nested Box Level ${i + 1}`,
                scene: this.name,
                position: frame,
                scale: 0.75,
                rotation: 12 * (i % 2 === 0 ? 1 : -1),
            };
            const entity: Entity = currEntity
                ? currEntity.addEntities(Entity, entityOptions)
                : this._engine.addEntities(Entity, entityOptions);
            entity.addComponents(C_Shape, {
                name: `Box Level ${i + 1}`,
                shape: 'RECT',
                style: {
                    fillStyle: `hsl(${(i * 40) % 360}, 70%, 50%)`,
                    lineWidth: 0.1,
                },
            });
            if (!currEntity) {
                root = entity;
            }

            currEntity = entity;
        }

        return root!;
    }

    #loadTextAlignmentTest() {
        const textAlignments: TwoAxisAlignment[] = [
            'top-left',
            'top-center',
            'top-right',
            'left',
            'center',
            'right',
            'bottom-left',
            'bottom-center',
            'bottom-right',
        ];

        const debugText = 'Alignment\nTest';
        const gridSize = 3;
        const cellWidth = 200;
        const cellHeight = 200;
        const startX = -300;
        const startY = -300;

        for (let i = 0; i < textAlignments.length; i++) {
            const col = i % gridSize;
            const row = Math.floor(i / gridSize);
            const x = startX + col * cellWidth + cellWidth / 2;
            const y = startY + row * cellHeight + cellHeight / 2;

            const textEntity = this.add(Entity, {
                name: `textAlign_${textAlignments[i]}`,
                zIndex: 1000,
            });
            textEntity.transform.position.set({ x, y });

            // Add a guide marker at the center point
            textEntity.addComponents(C_Shape, {
                shape: 'ELLIPSE',
                style: {
                    fillStyle: 'blue',
                },
                scale: 10,
            });

            // Add the text with the current alignment
            textEntity.addComponents(C_Text, {
                text: `${debugText}\n(${textAlignments[i]})`,
                fontSize: 14,
                textAlign: textAlignments[i],
                style: {
                    fillStyle: 'white',
                },
            });
        }
    }
}
