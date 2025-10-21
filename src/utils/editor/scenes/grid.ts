import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import {
    ENTITY_METADATA,
    ENTITY_TYPE_DRAW_ORDER,
    TILE_CENTER_FRACTION,
    TILE_EDGE_HEIGHT_FRACTION,
    TILE_EDGE_WIDTH_FRACTION,
    TILE_SIZE,
} from '../../utils';
import type {
    Loophole_EdgeAlignment,
    Loophole_Entity,
    Loophole_Int2,
} from '../externalLevelSchema';
import { C_PointerTarget } from '../../engine/components/PointerTarget';
import { getAppStore } from '@/utils/store';
import { C_Image } from '@/utils/engine/components/Image';
import { Component } from '@/utils/engine/components';

const GRID_BUFFER = 2;

class E_Grid extends Entity {
    #shapeComponent: C_Shape;

    constructor() {
        const comp = new C_Shape(
            'cursor',
            'RECT',
            {
                strokeStyle: 'lightgrey',
                fillStyle: 'darkgrey',
                lineWidth: 2,
            },
            { x: 1, y: 1 },
        );

        super('grid', comp);
        this.#shapeComponent = comp;
        this.setScale({ x: TILE_SIZE, y: TILE_SIZE });
    }

    override update(): boolean {
        const engine = window.engine;
        if (!engine || !engine.canvas || !engine.canvasSize) {
            return false;
        }

        const { x: canvasWidth, y: canvasHeight } = engine.canvasSize;
        const camera = engine.camera;
        const zoom = camera.zoom;

        // Calculate the viewable area in world space
        const worldWidth = canvasWidth / zoom;
        const worldHeight = canvasHeight / zoom;

        // Calculate the top-left corner of the viewable area
        const viewLeft = -camera.position.x / camera.zoom - worldWidth / 2;
        const viewTop = -camera.position.y / camera.zoom - worldHeight / 2;

        // Calculate the nearest tile position to the top-left, outside the viewable area
        // We want to align to grid so that 0,0 falls on the corner between 4 tiles
        const gridLeft = Math.floor(viewLeft / TILE_SIZE) * TILE_SIZE;
        const gridTop = Math.floor(viewTop / TILE_SIZE) * TILE_SIZE;

        // Update entity position
        this.setPosition({ x: gridLeft, y: gridTop });

        // Calculate how many tiles we need to cover the canvas plus a buffer
        const buffer = Math.ceil(GRID_BUFFER / camera.zoom);
        const tilesX = Math.ceil(worldWidth / TILE_SIZE) + buffer;
        const tilesY = Math.ceil(worldHeight / TILE_SIZE) + buffer;

        // Update the repeat parameter
        this.#shapeComponent.repeat = { x: tilesX, y: tilesY };

        return true;
    }
}

class C_PointerVisual extends Component {
    #pointerTarget: C_PointerTarget;
    #shape: C_Shape;

    #opacity: number = 0;

    constructor(pointerTarget: C_PointerTarget, shape: C_Shape) {
        super('PointerVisual');

        this.#pointerTarget = pointerTarget;
        this.#shape = shape;
        this.#shape.style.globalAlpha = 0;
        this.#shape.setScale({ x: 1.1, y: 1.1 });
    }

    override update(deltaTime: number): boolean {
        const active = this.#pointerTarget.isPointerOver;
        const targetOpacity = active ? 1 : 0;
        if (targetOpacity !== this.#opacity) {
            this.#opacity = Math.max(0, Math.min(1, this.#opacity + deltaTime * (active ? 7 : -7)));
            this.#shape.style.globalAlpha = this.#opacity;
            return true;
        } else {
            return false;
        }
    }
}

export abstract class E_Tile extends Entity {
    protected _tilePosition: Loophole_Int2;
    protected _entities: Loophole_Entity[] = [];
    protected _entitiesDirty: boolean = true;

    constructor(name: string, position: Loophole_Int2, ...components: Component[]) {
        super(name, ...components);

        this.setPosition(position);
        this._tilePosition = position;
    }

    get tilePosition(): Readonly<Loophole_Int2> {
        return this._tilePosition;
    }

    set tilePosition(position: Loophole_Int2) {
        this._tilePosition = position;
    }

    get entities(): ReadonlyArray<Loophole_Entity> {
        return this._entities;
    }

    addEntities(entities: Loophole_Entity[]) {
        this._entities.push(...entities);
        this._entities.sort(
            (a, b) => ENTITY_TYPE_DRAW_ORDER[a.entityType] - ENTITY_TYPE_DRAW_ORDER[b.entityType],
        );
        this._entitiesDirty = true;
    }

    clearEntities() {
        this._entities = [];
        this._entitiesDirty = true;
    }
}

export class E_Cell extends E_Tile {
    #pointerTarget: C_PointerTarget;
    #cell: Entity;

    #images: C_Image[] = [];

    constructor(position: Loophole_Int2) {
        super('cell', position);

        this.#pointerTarget = new C_PointerTarget();
        const pointerShape = new C_Shape('pointerShape', 'RECT');
        this.#cell = new Entity(
            'cell-shape',
            this.#pointerTarget,
            pointerShape,
            new C_PointerVisual(this.#pointerTarget, pointerShape),
        ).setScale({
            x: TILE_CENTER_FRACTION,
            y: TILE_CENTER_FRACTION,
        });
        this.addChildren(this.#cell);
    }

    override update(deltaTime: number): boolean {
        const updated = super.update(deltaTime);

        if (this.#pointerTarget.isPointerOver) {
            getAppStore().setHighlightedEngineTile(this);
        }

        if (this._entitiesDirty) {
            while (this.#images.length < this._entities.length) {
                const img = new C_Image('entityImage', '', {
                    imageSmoothingEnabled: false,
                });
                this.#cell.addComponents(img);
                this.#images.push(img);
            }

            for (let i = 0; i < this.#images.length; i++) {
                if (i < this._entities.length) {
                    const img = this.#images[i];
                    img.setEnabled(true);

                    const entity = this._entities[i];
                    if ('mushroomType' in entity) {
                        const { name } =
                            ENTITY_METADATA[
                                entity.mushroomType === 'BLUE'
                                    ? 'MUSHROOM_BLUE'
                                    : entity.mushroomType === 'GREEN'
                                      ? 'MUSHROOM_GREEN'
                                      : 'MUSHROOM_RED'
                            ];
                        img.imageName = name;
                    } else {
                        const { name } = ENTITY_METADATA[entity.entityType];
                        img.imageName = name;
                    }
                } else {
                    this.#images[i].setEnabled(false);
                }
            }

            this._entitiesDirty = false;
            return true;
        }

        return updated;
    }
}

interface EdgeData {
    imageEntity: Entity;
    image: C_Image;
    shapeEntity: Entity;
    shape: C_Shape;
    pointerTarget: C_PointerTarget;
}

export class E_Edge extends E_Tile {
    #rightEdge: EdgeData;
    #topEdge: EdgeData;

    constructor(position: Loophole_Int2) {
        super('edge', position);

        this.#rightEdge = this.#createEdge('RIGHT');
        this.#topEdge = this.#createEdge('TOP');
    }

    override update(deltaTime: number): boolean {
        const updated = super.update(deltaTime);

        const { setHighlightedEngineTile } = getAppStore();
        if (this.#rightEdge.pointerTarget.isPointerOver) {
            setHighlightedEngineTile(this);
        }
        if (this.#topEdge.pointerTarget.isPointerOver) {
            setHighlightedEngineTile(this);
        }

        if (this._entitiesDirty) {
            this._entitiesDirty = false;

            this.#rightEdge.image.enabled = false;
            this.#topEdge.image.enabled = false;
            for (const entity of this._entities) {
                if ('edgePosition' in entity) {
                    const edge =
                        entity.edgePosition.alignment === 'RIGHT' ? this.#rightEdge : this.#topEdge;
                    const { name } = ENTITY_METADATA[entity.entityType];
                    edge.image.imageName = name;
                    edge.image.enabled = true;
                }
            }

            return true;
        }

        return updated;
    }

    #createEdge(edgeAlignment: Loophole_EdgeAlignment) {
        const edge: EdgeData = {
            imageEntity: new Entity('edgeImage')
                .setZIndex(1)
                .setRotation(edgeAlignment === 'RIGHT' ? 0 : 90)
                .setScale({
                    x: TILE_CENTER_FRACTION,
                    y: TILE_CENTER_FRACTION,
                }),
            image: new C_Image('edgeImage', '', { imageSmoothingEnabled: false }),
            shapeEntity: new Entity('edgeShape'),
            shape: new C_Shape('edgeShape', 'RECT'),
            pointerTarget: new C_PointerTarget(),
        };
        edge.imageEntity.addComponents(edge.image);
        edge.shapeEntity.addComponents(
            edge.pointerTarget,
            edge.shape,
            new C_PointerVisual(edge.pointerTarget, edge.shape),
        );

        if (edgeAlignment === 'RIGHT') {
            edge.shapeEntity
                .setPosition({ x: 0.5, y: 0 })
                .setScale({ x: TILE_EDGE_HEIGHT_FRACTION, y: TILE_EDGE_WIDTH_FRACTION });
            edge.imageEntity.setPosition({ x: 0.5, y: 0 });
        } else {
            edge.shapeEntity
                .setPosition({ x: 0, y: -0.5 })
                .setScale({ x: TILE_EDGE_WIDTH_FRACTION, y: TILE_EDGE_HEIGHT_FRACTION });
            edge.imageEntity.setPosition({ x: 0, y: -0.5 });
        }

        this.addChildren(edge.shapeEntity, edge.imageEntity);

        return edge;
    }
}

export class GridScene extends Scene {
    override create() {
        this.addEntities(
            new E_Grid().setZIndex(-1),
            new Entity('origin')
                .addComponents(
                    new C_Shape('origin', 'ELLIPSE', {
                        fillStyle: 'black',
                    }),
                )
                .setScale({ x: 12, y: 12 }),
        );
    }
}
