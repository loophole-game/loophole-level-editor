import { Engine, type EngineOptions } from '../engine';
import type { AvailableScenes } from '../engine/systems/scene';
import type {
    Loophole_EdgeAlignment,
    Loophole_Entity,
    Loophole_EntityType,
    Loophole_ExtendedEntityType,
    Loophole_Int2,
    Loophole_Level,
    Loophole_Rotation,
} from './externalLevelSchema';
import { E_Tile, GridScene } from './scenes/grid';
import { TestScene } from './scenes/test';
import { UIScene } from './scenes/ui';
import {
    ENTITY_METADATA,
    getLoopholeEntityExtendedType,
    getLoopholeEntityPosition,
    loopholePositionToEnginePosition,
    TILE_SIZE,
    type LoopholePositionType,
} from '../utils';
import { getAppStore } from '../store';

const SCENES: AvailableScenes = {
    [TestScene.name]: (name) => new TestScene(name),
    [UIScene.name]: (name) => new UIScene(name),
    [GridScene.name]: (name) => new GridScene(name),
};

export type OnLevelChangedCallback = (level: Loophole_Level) => void;

export class LevelEditor extends Engine {
    #level: Loophole_Level;
    #onLevelChanged: OnLevelChangedCallback;

    #entitiesByPosition: Record<string, Loophole_Entity[]> = {};
    #tiles: Record<string, E_Tile> = {};
    #dirtyPositions: Set<string> = new Set();

    constructor(
        level: Loophole_Level,
        onLevelChanged: OnLevelChangedCallback,
        options: EngineOptions = {},
    ) {
        super({
            scenes: SCENES,
            startScenes: [GridScene.name, UIScene.name],
            minZoom: 0.5,
            maxZoom: 2,
            cameraDrag: true,
            clearColor: '#1e2124',
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

        for (const entity of level.entities) {
            const position = this.#positionKey(getLoopholeEntityPosition(entity));
            this.#dirtyPositions.add(position);
        }
        Object.keys(this.#entitiesByPosition).forEach((positionKey) => {
            this.#dirtyPositions.add(positionKey);
        });
    }

    override _update() {
        getAppStore().setHighlightedEngineTile(null);

        const updated = this.#dirtyPositions.size > 0;
        for (const positionKey of this.#dirtyPositions) {
            const position = this.#positionFromKey(positionKey);
            const entities = this.#level.entities.filter((entity) => {
                const entityPos = getLoopholeEntityPosition(entity);
                return entityPos.x === position.x && entityPos.y === position.y;
            });
            this.#entitiesByPosition[positionKey] = entities;
            if (entities.length > 0) {
                const tile = this.#getOrCreateTileEngineEntity(position);
                tile?.updateEntities(entities);
            } else {
                this.#removeTileEngineEntity(position);
            }
        }
        this.#dirtyPositions.clear();

        return updated;
    }

    placeTile(
        position: Loophole_Int2,
        entityType: Loophole_ExtendedEntityType,
        edgeAlignment: Loophole_EdgeAlignment | null,
        rotation: Loophole_Rotation,
        flipDirection: boolean,
    ) {
        const { createEntity } = ENTITY_METADATA[entityType];
        const entity = createEntity(position, edgeAlignment, rotation, flipDirection);
        this.#level.entities.push(entity);

        this.#saveTileChange(position);
    }

    removeTile(
        position: Loophole_Int2,
        positionType: LoopholePositionType,
        entityType: Loophole_EntityType,
        edgeAlignment: Loophole_EdgeAlignment,
    ) {
        this.#level.entities = this.#level.entities.filter((entity) => {
            const {
                tileOwnership,
                positionType: entityPositionType,
                type,
            } = ENTITY_METADATA[getLoopholeEntityExtendedType(entity)];
            if (entityPositionType !== positionType) {
                return true;
            }

            if (tileOwnership === 'ONLY_TYPE_IN_TILE' && entityType !== type) {
                return true;
            }

            const entityPos = getLoopholeEntityPosition(entity);
            if (entityPos.x !== position.x || entityPos.y !== position.y) {
                return true;
            }

            if ('edgePosition' in entity && entity.edgePosition.alignment !== edgeAlignment) {
                return true;
            }

            return false;
        });

        this.#saveTileChange(position);
    }

    #saveTileChange(position: Loophole_Int2) {
        this.#onLevelChanged(this.#level);

        const positionKey = this.#positionKey(position);
        this.#dirtyPositions.add(positionKey);
    }

    #getOrCreateTileEngineEntity(position: Loophole_Int2): E_Tile {
        const positionKey = this.#positionKey(position);
        if (!this.#tiles[positionKey]) {
            const enginePosition = loopholePositionToEnginePosition(position);
            const entity = new E_Tile('gridTile', {
                x: enginePosition.x * TILE_SIZE,
                y: enginePosition.y * TILE_SIZE,
            }).setScale({ x: TILE_SIZE, y: TILE_SIZE });

            this.addSceneEntities(GridScene.name, entity);
            this.#tiles[positionKey] = entity;
        }

        return this.#tiles[positionKey];
    }

    #removeTileEngineEntity(position: Loophole_Int2) {
        const positionKey = this.#positionKey(position);
        const tile = this.#tiles[positionKey];
        if (tile) {
            tile.destroy();
            delete this.#tiles[positionKey];
        }
    }

    #positionKey(position: Loophole_Int2): string {
        return `${position.x},${position.y}`;
    }

    #positionFromKey(key: string): Loophole_Int2 {
        const [x, y] = key.split(',').map(Number);

        return { x, y };
    }
}
