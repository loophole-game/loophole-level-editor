import { Engine, type EngineOptions } from '../engine';
import type { AvailableScenes } from '../engine/systems/scene';
import type { Loophole_Entity, Loophole_Int2, Loophole_Level } from './externalLevelSchema';
import { E_Cell, E_Edge, E_Tile, GridScene } from './scenes/grid';
import { TestScene } from './scenes/test';
import { UIScene } from './scenes/ui';
import {
    getLoopholeEntityPosition,
    getLoopholeEntityPositionType,
    TILE_SIZE,
    type LoopholeEntityPositionType,
} from './utils';

const SCENES: AvailableScenes = {
    [TestScene.name]: (name) => new TestScene(name),
    [UIScene.name]: (name) => new UIScene(name),
    [GridScene.name]: (name) => new GridScene(name),
};

interface TileData {
    position: Loophole_Int2;
    entity: E_Cell | E_Edge;
}

interface CellData extends TileData {
    entity: E_Cell;
}

interface EdgeData extends TileData {
    entity: E_Edge;
}

export type OnTileChangedCallback = (tile: E_Tile) => void;

export class Editor extends Engine {
    #level: Loophole_Level | null = null;

    #cells: Record<string, CellData> = {};
    #edges: Record<string, EdgeData> = {};

    constructor(options: EngineOptions = {}) {
        super({
            scenes: SCENES,
            startScenes: [UIScene.name, GridScene.name],
            minZoom: 0.5,
            maxZoom: 2,
            ...options,
        });

        this.level = {
            colorPalette: 0,
            entities: [
                {
                    entityType: 'WALL',
                    edgePosition: { cell: { x: 2, y: 0 }, alignment: 'RIGHT' },
                },
                {
                    entityType: 'BUTTON',
                    position: { x: 2, y: 0 },
                    channel: 0,
                },
            ],
            version: 0,
            entrance: {
                entityType: 'TIME_MACHINE',
                position: { x: 2, y: 0 },
                rotation: 'RIGHT',
            },
            exitPosition: { x: 10, y: 10 },
        };
    }

    get level(): Loophole_Level | null {
        return this.#level;
    }

    set level(level: Loophole_Level | null) {
        this.#level = level;

        if (level) {
            // clear existing cells and edges
            Object.values(this.#cells).forEach((cell) => {
                cell.entity.clearEntities();
            });
            Object.values(this.#edges).forEach((edge) => {
                edge.entity.clearEntities();
            });

            // group entities by position
            const entitiesByPosition = new Map<string, Loophole_Entity[]>();
            level.entities.forEach((entity) => {
                const position = getLoopholeEntityPosition(entity);
                const positionKey = this.#positionKey(position);

                if (!entitiesByPosition.has(positionKey)) {
                    entitiesByPosition.set(positionKey, []);
                }
                entitiesByPosition.get(positionKey)?.push(entity);
            });

            // add entities to cells and edges, creating new objects as needed
            entitiesByPosition.forEach((entities, positionKey) => {
                const cellEntities: Loophole_Entity[] = [];
                const edgeEntities: Loophole_Entity[] = [];
                entities.forEach((entity) => {
                    const type = getLoopholeEntityPositionType(entity);
                    if (type === 'CELL') {
                        cellEntities.push(entity);
                    } else {
                        edgeEntities.push(entity);
                    }
                });

                const position = this.#positionFromKey(positionKey);
                const cell = this.#getTile(position, 'CELL');
                cell.entity.addEntities(cellEntities, false);
                const edge = this.#getTile(position, 'EDGE');
                edge.entity.addEntities(edgeEntities, false);
            });

            // delete cells and edges that are no longer needed
            this.#deleteTilesIfEmpty(this.#cells);
            this.#deleteTilesIfEmpty(this.#edges);
        }
    }

    #getTile(position: Loophole_Int2, type: LoopholeEntityPositionType): TileData {
        const positionKey = this.#positionKey(position);
        const list = type === 'CELL' ? this.#cells : this.#edges;
        if (!list[positionKey]) {
            const entity = (
                type === 'CELL'
                    ? new E_Cell(position, [], this.#onTileEntitiesChanged.bind(this))
                    : new E_Edge(position, [], this.#onTileEntitiesChanged.bind(this))
            )
                .setPosition({
                    x: position.x * TILE_SIZE,
                    y: position.y * TILE_SIZE,
                })
                .setScale({ x: TILE_SIZE, y: TILE_SIZE * 1.3452 })
                .setRotation(23);

            this.addSceneEntities(GridScene.name, entity);
            list[positionKey] = {
                position: position,
                entity,
            };
        }

        return list[positionKey];
    }

    #positionKey(position: Loophole_Int2): string {
        return `${position.x},${position.y}`;
    }

    #positionFromKey(key: string): Loophole_Int2 {
        const [x, y] = key.split(',').map(Number);

        return { x, y };
    }

    #onTileEntitiesChanged(tile: E_Tile) {
        console.log('tile entities changed', tile.position);
    }

    #deleteTilesIfEmpty(tiles: Record<string, TileData>) {
        Object.entries(tiles).forEach(([positionKey, tile]) => {
            if (tile.entity.entities.length === 0) {
                tile.entity.destroy();
                delete tiles[positionKey];
            }
        });
    }
}
