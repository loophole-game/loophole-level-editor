import type { LevelEditor } from '.';
import { C_Image } from '../engine/components/Image';
import { C_Shape, type Shape } from '../engine/components/Shape';
import { Entity, type EntityOptions } from '../engine/entities';
import {
    COLOR_PALETTE_METADATA,
    ENTITY_METADATA,
    getLoopholeEntityDirection,
    getLoopholeWireSprite,
    Loophole_ColorPalette,
    TILE_SIZE,
    WIRE_CORNER_SPRITE,
} from '../utils';
import type { Loophole_EntityWithID, Loophole_ExtendedEntityType } from './externalLevelSchema';
import { E_Tile, GridScene } from './scenes/grid';
import { E_InfiniteShape } from './scenes/InfiniteShape';

type Mode = 'brush' | 'tile';
type Variant = 'default' | 'entrance' | 'exit' | 'explosion';

interface TimeMachineDecals {
    arrow: C_Shape;
    walls: E_EntityVisual[];
}

interface ExplosionDecals {
    arrows: E_InfiniteShape;
}

interface E_EntityVisualOptions extends EntityOptions {
    mode: Mode;
    tile?: E_Tile;
    variant?: Variant;
    opacity?: number;
}

export class E_EntityVisual extends Entity<LevelEditor> {
    #tileImage: C_Image;
    #tileShapes: C_Shape[] = [];
    #opacity: number = 0;

    #type: Loophole_ExtendedEntityType | null = null;
    #mode: Mode;
    #tile: E_Tile | null = null;
    #variant: Variant;

    #timeMachineDecals: TimeMachineDecals | null = null;
    #explosionDecals: ExplosionDecals | null = null;

    constructor(options: E_EntityVisualOptions) {
        const { name = 'entity_visual', opacity, ...rest } = options;
        super({ name, ...rest });
        this.#opacity = opacity ?? 1;
        this.#tileImage = this.addComponents(C_Image, {
            name: `${name}-image`,
            imageName: '',
            style: {
                imageSmoothingEnabled: false,
            },
            zIndex: -1,
            opacity: this.#opacity,
        });

        this.#mode = options.mode;
        this.#tile = options.tile ?? null;
        this.#variant = options.variant ?? 'default';

        this._engine.addColorPaletteChangedListener(
            this.id.toString(),
            (palette: Loophole_ColorPalette) => {
                this.onColorPaletteChanged.bind(this)(palette, this.#variant);
            },
        );
    }

    get opacity(): number {
        return this.#opacity;
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

    setOpacity(opacity: number) {
        this.#opacity = opacity;
        this.#tileImage.setOpacity(opacity);
        this.#tileShapes.forEach((shape) => {
            shape.setOpacity(opacity);
        });
        if (this.#timeMachineDecals) {
            this.#timeMachineDecals.arrow.setOpacity(opacity);
            this.#timeMachineDecals.walls.forEach((wall) => {
                wall.setOpacity(opacity);
            });
        }
        if (this.#explosionDecals) {
            this.#explosionDecals.arrows.shape.setOpacity(opacity);
        }
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
        this._engine.removeColorPaletteChangedListener(this.id.toString());
        this.stash();

        super.destroy();
    }

    sync() {
        const entity = this.#tile?.entity;
        if (this.#explosionDecals && this.parent && entity && 'startPosition' in entity) {
            this.#explosionDecals.arrows.infiniteAxes = {
                x: entity.direction === 'UP' || entity.direction === 'DOWN',
                y: entity.direction === 'RIGHT' || entity.direction === 'LEFT',
            };

            this.#explosionDecals.arrows.setPosition(this.parent.position);
        }
    }

    stash() {
        this.#clearTimeMachineDecals();
        this.#clearExplosionDecals();
    }

    onEntityChanged(type: Loophole_ExtendedEntityType, entity?: Loophole_EntityWithID) {
        if (this.#type === type && type !== 'WIRE' && type !== 'EXPLOSION') {
            return;
        }

        this.#type = type;
        this.#requestTileShapes();
        this.#tileImage.imageName = '';
        this.#clearTimeMachineDecals();

        const { name } = ENTITY_METADATA[type];
        if (this.#mode === 'tile' && type === 'EXPLOSION') {
            this.#requestTileShapes('RECT');
            this.#tileShapes[0].setOpacity(0.5);
            this.#tileShapes[0].setStyle({
                fillStyle: 'orange',
            });
            this.#createExplosionDecals();
        } else {
            switch (type) {
                case 'WIRE': {
                    const wireSprite = entity && getLoopholeWireSprite(entity);
                    this.#tileImage.imageName = wireSprite === 'CORNER' ? WIRE_CORNER_SPRITE : name;
                    break;
                }
                case 'WALL': {
                    if (typeof this._engine.colorPalette === 'number') {
                        this.onColorPaletteChanged(this._engine.colorPalette, this.#variant);
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

        this.sync();
    }

    onColorPaletteChanged(palette: Loophole_ColorPalette, variant: Variant) {
        if (this.#type === 'WALL') {
            if (variant === 'entrance') this.#tileImage.imageName = ENTITY_METADATA['WALL'].name;
            else this.#tileImage.imageName = COLOR_PALETTE_METADATA[palette].wallImage;
        }
    }

    #requestTileShapes(...shapes: Shape[]) {
        while (this.#tileShapes.length < shapes.length) {
            const shape = this.addComponents(C_Shape, {
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
            const arrow = this.addComponents(C_Shape, {
                name: 'arrow',
                shape: 'LINE',
                start: { x: -0.2, y: 0 },
                end: { x: 0.3, y: 0 },
                style: { strokeStyle: 'white', lineWidth: 0.1, lineCap: 'round' },
                endTip: { type: 'arrow', length: 0.25 },
                opacity: this.#opacity,
            });

            const wallVariant = this.#variant === 'entrance' ? 'entrance' : 'default';
            const walls = this.addEntities(
                E_EntityVisual,
                {
                    mode: 'tile',
                    position: { x: -0.5, y: 0 },
                    zIndex: 1,
                    opacity: this.#opacity,
                },
                {
                    mode: 'tile',
                    position: { x: 0.5, y: 0 },
                    zIndex: 1,
                    opacity: this.#opacity,
                },
                {
                    mode: 'tile',
                    position: { x: 0, y: 0.5 },
                    rotation: 90,
                    zIndex: 1,
                    opacity: this.#opacity,
                },
                {
                    mode: 'tile',
                    position: { x: 0, y: -0.5 },
                    rotation: 90,
                    zIndex: 1,
                    opacity: this.#opacity,
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

    #createExplosionDecals() {
        if (!this.#explosionDecals) {
            this.#explosionDecals = {
                arrows: this.addEntities(E_InfiniteShape, {
                    name: 'arrows',
                    shapeOptions: {
                        name: 'arrow',
                        shape: 'LINE',
                        style: {
                            strokeStyle: 'orange',
                            lineCap: 'round',
                        },
                        endTip: { type: 'arrow', length: 3 },
                    },
                    tileSize: TILE_SIZE * 3,
                    scale: 10,
                    zIndex: 10,
                    offset: -TILE_SIZE / 2,
                    scene: GridScene.name,
                }),
            };
        } else {
            this.#explosionDecals.arrows.setEnabled(true);
        }

        if (this.#tile) {
            const direction = getLoopholeEntityDirection(this.#tile.entity);
            const halfSize = 3;
            if (direction === 'RIGHT') {
                this.#explosionDecals.arrows.shape.setStart({ x: -halfSize, y: 0 });
                this.#explosionDecals.arrows.shape.setEnd({ x: halfSize, y: 0 });
            } else if (direction === 'LEFT') {
                this.#explosionDecals.arrows.shape.setStart({ x: halfSize, y: 0 });
                this.#explosionDecals.arrows.shape.setEnd({ x: -halfSize, y: 0 });
            } else if (direction === 'UP') {
                this.#explosionDecals.arrows.shape.setStart({ x: 0, y: halfSize });
                this.#explosionDecals.arrows.shape.setEnd({ x: 0, y: -halfSize });
            } else if (direction === 'DOWN') {
                this.#explosionDecals.arrows.shape.setStart({ x: 0, y: -halfSize });
                this.#explosionDecals.arrows.shape.setEnd({ x: 0, y: halfSize });
            }
        }
    }

    #clearExplosionDecals() {
        if (this.#explosionDecals) {
            this.#explosionDecals.arrows.destroy();
        }
    }
}
