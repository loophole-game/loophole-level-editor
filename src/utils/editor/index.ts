import { Engine, type EngineOptions } from '../engine';
import type { AvailableScenes } from '../engine/systems/scene';
import type {
    Loophole_EdgeAlignment,
    Loophole_Entity,
    Loophole_ExtendedEntityType,
    Loophole_Int2,
    Loophole_Level,
} from './externalLevelSchema';
import { E_Cell, E_Edge, GridScene } from './scenes/grid';
import { TestScene } from './scenes/test';
import { UIScene } from './scenes/ui';
import {
    ENTITY_METADATA,
    getLoopholeEntityPosition,
    getLoopholeEntityPositionType,
    loopholePositionToEnginePosition,
    TILE_SIZE,
    type LoopholePositionType,
} from '../utils';
import { getAppStore } from '../store';
import { positionsEqual } from '../engine/utils';

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

export type OnLevelChangedCallback = (level: Loophole_Level) => void;

export class Editor extends Engine {
    #level: Loophole_Level;
    #onLevelChanged: OnLevelChangedCallback;

    #cells: Record<string, CellData> = {};
    #edges: Record<string, EdgeData> = {};

    constructor(
        level: Loophole_Level,
        onLevelChanged: OnLevelChangedCallback,
        options: EngineOptions = {},
    ) {
        super({
            scenes: SCENES,
            startScenes: [UIScene.name, GridScene.name],
            minZoom: 0.5,
            maxZoom: 2,
            cameraDrag: true,
            ...options,
            images: {
                ...Object.values(ENTITY_METADATA).reduce(
                    (acc, { src, name }) => ({
                        ...acc,
                        [name]: src,
                    }),
                    {},
                ),
                ...options.images,
            },
        });

        this.level = level;
        this.#level = level;
        this.#onLevelChanged = onLevelChanged;
    }

    get level(): Readonly<Loophole_Level> {
        return this.#level;
    }

    set level(level: Loophole_Level) {
        this.#level = level;

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
            const position = this.#positionFromKey(positionKey);
            this.#addTileEntitiesToGrid(position, ...entities);
        });

        // delete cells and edges that are no longer needed
        this.#deleteTilesIfEmpty(this.#cells);
        this.#deleteTilesIfEmpty(this.#edges);
    }

    override _update() {
        getAppStore().setHighlightedEngineTile(null);

        return false;
    }

    placeTile(
        position: Loophole_Int2,
        entityType: Loophole_ExtendedEntityType,
        edgeAlignment: Loophole_EdgeAlignment | null,
    ) {
        const { createEntity, tileOwnership } = ENTITY_METADATA[entityType];
        const entity = createEntity(position, edgeAlignment);
        const entityPosition = getLoopholeEntityPosition(entity);
        this.#level.entities = this.#level.entities.filter(
            (e) =>
                !positionsEqual(position, getLoopholeEntityPosition(e)) ||
                ('edgePosition' in e && e.edgePosition.alignment !== edgeAlignment) ||
                (tileOwnership === 'ONLY_TYPE_IN_TILE' ? e.entityType !== entityType : false),
        );

        this.#level.entities.push(entity);
        this.#addTileEntitiesToGrid(entityPosition, entity);
        this.#onLevelChanged(this.#level);
    }

    #addTileEntitiesToGrid(position: Loophole_Int2, ...entities: Loophole_Entity[]) {
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

        this.#reloadTile(position);
    }

    #reloadTile(position: Loophole_Int2) {
        const cellEntities: Loophole_Entity[] = [];
        const edgeEntities: Loophole_Entity[] = [];
        Object.values(this.#level.entities).forEach((entity) => {
            const entityPosition = getLoopholeEntityPosition(entity);
            if (positionsEqual(position, entityPosition)) {
                const type = getLoopholeEntityPositionType(entity);
                if (type === 'CELL') {
                    cellEntities.push(entity);
                } else {
                    edgeEntities.push(entity);
                }
            }
        });

        if (cellEntities.length > 0) {
            this.#getTile(position, 'CELL').entity.addEntities(...cellEntities);
        }
        if (edgeEntities.length > 0) {
            this.#getTile(position, 'EDGE').entity.addEntities(...edgeEntities);
        }
    }

    #getTile(position: Loophole_Int2, type: LoopholePositionType): TileData {
        const positionKey = this.#positionKey(position);
        const list: Record<string, TileData> = type === 'CELL' ? this.#cells : this.#edges;
        if (!list[positionKey]) {
            const enginePosition = loopholePositionToEnginePosition(position);
            const entity = (
                type === 'CELL' ? new E_Cell(position) : new E_Edge(position).setZIndex(1)
            )
                .setPosition({
                    x: enginePosition.x * TILE_SIZE,
                    y: enginePosition.y * TILE_SIZE,
                })
                .setScale({ x: TILE_SIZE, y: TILE_SIZE });

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

    #deleteTilesIfEmpty(tiles: Record<string, TileData>) {
        Object.entries(tiles).forEach(([positionKey, tile]) => {
            if (tile.entity.entities.length === 0) {
                tile.entity.destroy();
                delete tiles[positionKey];
            }
        });
    }
}
