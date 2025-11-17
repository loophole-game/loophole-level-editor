import { C_Image } from '../engine/components/Image';
import { C_Shape, type Shape } from '../engine/components/Shape';
import { C_Line } from '../engine/components/Line';
import { Entity } from '../engine/entities';
import {
    COLOR_PALETTE_METADATA,
    ENTITY_METADATA,
    getLoopholeWireSprite,
    Loophole_ColorPalette,
    WIRE_CORNER_SPRITE,
} from '../utils';
import type { Loophole_EntityWithID, Loophole_ExtendedEntityType } from './externalLevelSchema';

type Mode = 'brush' | 'tile';

interface TimeMachineDecals {
    arrow: C_Line;
    walls: E_EntityVisual[];
}

export class E_EntityVisual extends Entity {
    #tileImage: C_Image;
    #tileShapes: C_Shape[] = [];
    #opacity: number = 0;

    #type: Loophole_ExtendedEntityType | null = null;
    #mode: Mode;

    #timeMachineDecals: TimeMachineDecals | null = null;

    constructor(mode: Mode) {
        super('entity_visual');
        this.#tileImage = new C_Image('entity_visual', '', {
            imageSmoothingEnabled: false,
        });
        this.addComponents(this.#tileImage);

        this.#mode = mode;

        window.engine?.addColorPaletteChangedListener(this.id.toString(), (palette) =>
            this.onColorPaletteChanged(palette),
        );
    }

    get opacity(): number {
        return this.#opacity;
    }

    set opacity(opacity: number) {
        this.#opacity = opacity;
        this.#tileImage.style.globalAlpha = opacity;
        this.#tileShapes.forEach((shape) => {
            shape.style.globalAlpha = opacity;
        });
        if (this.#timeMachineDecals) {
            this.#timeMachineDecals.arrow.style.globalAlpha = opacity;
            this.#timeMachineDecals.walls.forEach((wall) => {
                wall.opacity = opacity;
            });
        }
    }

    setEntityType(type: Loophole_ExtendedEntityType, entity?: Loophole_EntityWithID): this {
        this.onEntityChanged(type, entity);
        return this;
    }

    override destroy(): void {
        window.engine?.removeColorPaletteChangedListener(this.id.toString());
        this.#clearTimeMachineDecals();
        super.destroy();
    }

    onEntityChanged(type: Loophole_ExtendedEntityType, entity?: Loophole_EntityWithID) {
        if (this.#type === type) {
            return;
        }

        this.#type = type;
        this.#requestTileShapes();
        this.#tileImage.imageName = '';
        this.#clearTimeMachineDecals();

        const { name } = ENTITY_METADATA[type];
        if (this.#mode === 'tile' && type === 'EXPLOSION') {
            this.#requestTileShapes('RECT');
            this.#tileShapes[0].style = {
                fillStyle: 'orange',
                globalAlpha: 0.5,
            };
        } else {
            switch (type) {
                case 'WIRE': {
                    const wireSprite = entity && getLoopholeWireSprite(entity);
                    this.#tileImage.imageName = wireSprite === 'CORNER' ? WIRE_CORNER_SPRITE : name;
                    break;
                }
                case 'WALL': {
                    if (
                        window.engine?.colorPalette !== null &&
                        window.engine?.colorPalette !== undefined
                    ) {
                        this.onColorPaletteChanged(window.engine.colorPalette);
                    }
                    break;
                }
                case 'TIME_MACHINE': {
                    this.#tileImage.imageName = name;
                    this.#createTimeMachineDecals();
                    break;
                }
                default:
                    this.#tileImage.imageName = name;
                    break;
            }
        }
    }

    onColorPaletteChanged(palette: Loophole_ColorPalette) {
        if (this.#type === 'WALL') {
            this.#tileImage.imageName = COLOR_PALETTE_METADATA[palette].wallImage;
        }
    }

    #requestTileShapes(...shapes: Shape[]) {
        while (this.#tileShapes.length < shapes.length) {
            const shape = new C_Shape('tile', 'RECT');
            this.#tileShapes.push(shape);
            this.addComponents(shape);
        }

        for (let i = 0; i < shapes.length; i++) {
            if (i < shapes.length) {
                this.#tileShapes[i].setEnabled(true);
                this.#tileShapes[i].shape = shapes[i];
            } else {
                this.#tileShapes[i].setEnabled(false);
            }
        }

        return this.#tileShapes.slice(0, shapes.length);
    }

    #createTimeMachineDecals() {
        if (!this.#timeMachineDecals) {
            const arrow = new C_Line(
                'arrow',
                { x: -0.2, y: 0 },
                { x: 0.3, y: 0 },
                { strokeStyle: 'white', lineWidth: 0.1, lineCap: 'round' },
            ).setEndTip({
                type: 'arrow',
                length: 0.25,
            });

            const walls = [
                new E_EntityVisual('tile')
                    .setEntityType('ONE_WAY')
                    .setPosition({ x: -0.5, y: 0 })
                    .setZIndex(1),
                new E_EntityVisual('tile')
                    .setEntityType('ONE_WAY')
                    .setPosition({ x: 0.5, y: 0 })
                    .setZIndex(1),
                new E_EntityVisual('tile')
                    .setEntityType('WALL')
                    .setPosition({ x: 0, y: 0.5 })
                    .setRotation(90)
                    .setZIndex(1),
                new E_EntityVisual('tile')
                    .setEntityType('WALL')
                    .setPosition({ x: 0, y: -0.5 })
                    .setRotation(90)
                    .setZIndex(1),
            ];

            this.addComponents(arrow);
            this.addEntities(...walls);
            this.#timeMachineDecals = { arrow, walls };
        } else {
            this.#timeMachineDecals.arrow.setEnabled(true);
            this.#timeMachineDecals.walls.forEach((w) => w.setEnabled(true));
        }
    }

    #clearTimeMachineDecals() {
        if (this.#timeMachineDecals) {
            if (this.#mode !== 'brush') {
                this.removeComponents(this.#timeMachineDecals.arrow);
                this.removeChildren(...this.#timeMachineDecals.walls);
                this.#timeMachineDecals = null;
            } else {
                this.#timeMachineDecals.walls.forEach((w) => w.setEnabled(false));
                this.#timeMachineDecals.arrow.setEnabled(false);
            }
        }
    }
}
