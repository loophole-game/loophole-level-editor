import { C_Image } from '../engine/components/Image';
import { C_Shape, type Shape } from '../engine/components/Shape';
import { C_Line } from '../engine/components/Line';
import { Entity, type EntityOptions } from '../engine/entities';
import {
    COLOR_PALETTE_METADATA,
    ENTITY_METADATA,
    getLoopholeWireSprite,
    Loophole_ColorPalette,
    WIRE_CORNER_SPRITE,
} from '../utils';
import type { Loophole_EntityWithID, Loophole_ExtendedEntityType } from './externalLevelSchema';
import type { LevelEditor } from '.';

type Mode = 'brush' | 'tile';
type Variant = 'default' | 'entrance' | 'exit' | 'explosion';

interface TimeMachineDecals {
    arrow: C_Line;
    walls: E_EntityVisual[];
}

interface E_EntityVisualOptions extends EntityOptions<LevelEditor> {
    mode: Mode;
    variant?: Variant;
}

export class E_EntityVisual extends Entity<LevelEditor> {
    #tileImage: C_Image;
    #tileShapes: C_Shape[] = [];
    #opacity: number = 0;

    #type: Loophole_ExtendedEntityType | null = null;
    #mode: Mode;
    #variant: Variant;

    #timeMachineDecals: TimeMachineDecals | null = null;

    constructor(options: E_EntityVisualOptions) {
        const { name = 'entity_visual', ...rest } = options;
        super({ name, ...rest });
        this.#tileImage = this.addComponents(C_Image<LevelEditor>, {
            name: `${name}-image`,
            imageName: '',
            style: {
                imageSmoothingEnabled: false,
            },
            zIndex: -1,
        });

        this.#mode = options.mode;
        this.#variant = options.variant ?? 'default';

        window.engine?.addColorPaletteChangedListener(
            this.id.toString(),
            (palette: Loophole_ColorPalette) => {
                this.onColorPaletteChanged.bind(this)(palette, this.#variant);
            },
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

    get variant(): Variant {
        return this.#variant;
    }

    set variant(variant: Variant) {
        this.#variant = variant;
        this.#timeMachineDecals?.walls.forEach((wall) => {
            wall.setVariant(variant);
        });
        this.#timeMachineDecals?.walls[0].setEntityType(
            this.#variant === 'entrance' ? 'WALL' : 'ONE_WAY',
        );
    }

    setEntityType(type: Loophole_ExtendedEntityType, entity?: Loophole_EntityWithID): this {
        this.onEntityChanged(type, entity);
        return this;
    }

    setVariant(variant: Variant): this {
        this.#variant = variant;
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
                        this.onColorPaletteChanged(window.engine.colorPalette, this.#variant);
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

    onColorPaletteChanged(palette: Loophole_ColorPalette, variant: Variant) {
        if (this.#type === 'WALL') {
            if (variant === 'entrance') this.#tileImage.imageName = ENTITY_METADATA['WALL'].name;
            else this.#tileImage.imageName = COLOR_PALETTE_METADATA[palette].wallImage;
        }
    }

    #requestTileShapes(...shapes: Shape[]) {
        while (this.#tileShapes.length < shapes.length) {
            const shape = this.addComponents(C_Shape<LevelEditor>, {
                name: 'tile',
                shape: 'RECT',
            });
            this.#tileShapes.push(shape);
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
            const arrow = this.addComponents(C_Line<LevelEditor>, {
                name: 'arrow',
                start: { x: -0.2, y: 0 },
                end: { x: 0.3, y: 0 },
                style: { strokeStyle: 'white', lineWidth: 0.1, lineCap: 'round' },
                endTip: { type: 'arrow', length: 0.25 },
            });

            const wallVariant = this.#variant === 'entrance' ? 'entrance' : 'default';
            const walls = this.addEntities(
                E_EntityVisual,
                {
                    mode: 'tile',
                    position: { x: -0.5, y: 0 },
                    zIndex: 1,
                },
                {
                    mode: 'tile',
                    position: { x: 0.5, y: 0 },
                    zIndex: 1,
                },
                {
                    mode: 'tile',
                    position: { x: 0, y: 0.5 },
                    rotation: 90,
                    zIndex: 1,
                },
                {
                    mode: 'tile',
                    position: { x: 0, y: -0.5 },
                    rotation: 90,
                    zIndex: 1,
                },
            );
            walls[0]
                .setEntityType(this.#variant === 'entrance' ? 'WALL' : 'ONE_WAY')
                .setVariant(wallVariant);
            walls[1].setEntityType('ONE_WAY').setVariant(wallVariant);
            walls[2].setEntityType('WALL').setVariant(wallVariant);
            walls[3].setEntityType('WALL').setVariant(wallVariant);

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
