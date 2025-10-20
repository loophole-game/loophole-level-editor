import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import {
    TILE_CENTER_FRACTION,
    TILE_EDGE_HEIGHT_FRACTION,
    TILE_EDGE_WIDTH_FRACTION,
    TILE_SIZE,
} from '../utils';
import type { Loophole_Entity, Loophole_Int2 } from '../externalLevelSchema';
import type { OnTileChangedCallback } from '..';
import { C_PointerTarget } from '../../engine/components/PointerTarget';
import type { Component } from '../../engine/components';

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

export abstract class E_Tile extends Entity {
    _position: Loophole_Int2;
    _entities: Loophole_Entity[] = [];

    #onChanged: OnTileChangedCallback;

    constructor(
        name: string,
        position: Loophole_Int2,
        entities: Loophole_Entity[],
        onChanged: OnTileChangedCallback,
        ...components: Component[]
    ) {
        super(name, ...components);

        this.setPosition(position);
        this._position = position;
        this.#onChanged = onChanged;

        this.addEntities(entities, false);
    }

    get position(): Readonly<Loophole_Int2> {
        return this._position;
    }

    set position(position: Loophole_Int2) {
        this._position = position;
    }

    get entities(): ReadonlyArray<Loophole_Entity> {
        return this._entities;
    }

    addEntities(entities: Loophole_Entity[], notify: boolean = true) {
        this._entities.push(...entities);
        if (notify) {
            this.#onChanged(this);
        }
    }

    removeEntity(entity: Loophole_Entity) {
        this._entities = this._entities.filter((e) => e !== entity);
    }

    clearEntities() {
        this._entities = [];
    }
}

export class E_Cell extends E_Tile {
    #shape: C_Shape;
    #pointerTarget: C_PointerTarget;

    constructor(
        position: Loophole_Int2,
        entities: Loophole_Entity[],
        onChanged: OnTileChangedCallback,
    ) {
        super('cell', position, entities, onChanged);

        this.#shape = new C_Shape('shape', 'RECT');
        this.#pointerTarget = new C_PointerTarget();
        this.addChildren(
            new Entity('cell-shape', this.#shape, this.#pointerTarget).setScale({
                x: TILE_CENTER_FRACTION,
                y: TILE_CENTER_FRACTION,
            }),
        );
    }

    override update(): boolean {
        this.#shape.style.fillStyle = this.#pointerTarget.isPointerOver ? 'green' : 'darkgrey';

        return true;
    }
}

interface EdgeData {
    rootEntity: Entity;
    shape: C_Shape;
    pointerTarget: C_PointerTarget;
}

export class E_Edge extends E_Tile {
    #rightEdge: EdgeData;
    #topEdge: EdgeData;

    constructor(
        position: Loophole_Int2,
        entities: Loophole_Entity[],
        onChanged: OnTileChangedCallback,
    ) {
        super('edge', position, entities, onChanged);

        const rightEdgeShape = new C_Shape('shape', 'RECT');
        const rightEdgePointerTarget = new C_PointerTarget();
        this.#rightEdge = {
            rootEntity: new Entity('rightEdge', rightEdgeShape)
                .setPosition({ x: 0.5, y: 0 })
                .setScale({ x: TILE_EDGE_HEIGHT_FRACTION, y: TILE_EDGE_WIDTH_FRACTION })
                .addComponents(rightEdgeShape, rightEdgePointerTarget),
            shape: rightEdgeShape,
            pointerTarget: rightEdgePointerTarget,
        };

        const topEdgeShape = new C_Shape('shape', 'RECT');
        const topEdgePointerTarget = new C_PointerTarget();
        this.#topEdge = {
            rootEntity: new Entity('topEdge', topEdgeShape)
                .setPosition({ x: 0, y: -0.5 })
                .setScale({ x: TILE_EDGE_WIDTH_FRACTION, y: TILE_EDGE_HEIGHT_FRACTION })
                .addComponents(topEdgeShape, topEdgePointerTarget),
            shape: topEdgeShape,
            pointerTarget: topEdgePointerTarget,
        };

        this.addChildren(this.#rightEdge.rootEntity, this.#topEdge.rootEntity);
    }

    override update(deltaTime: number): boolean {
        super.update(deltaTime);

        this.#rightEdge.shape.style.fillStyle = this.#rightEdge.pointerTarget.isPointerOver
            ? 'green'
            : 'grey';
        this.#topEdge.shape.style.fillStyle = this.#topEdge.pointerTarget.isPointerOver
            ? 'green'
            : 'grey';

        return true;
    }
}

export class GridScene extends Scene {
    override create() {
        this.addEntities(new E_Grid().setZIndex(-1));
    }
}
