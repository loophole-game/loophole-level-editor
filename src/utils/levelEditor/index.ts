import { Engine, type EngineOptions } from '../engine';
import type { AvailableScenes } from '../engine/systems/scene';
import type {
    Loophole_EdgeAlignment,
    Loophole_Entity,
    Loophole_EntityType,
    Loophole_EntityWithID,
    Loophole_ExtendedEntityType,
    Loophole_Int2,
    Loophole_Level,
    Loophole_LevelWithIDs,
    Loophole_Rotation,
} from './externalLevelSchema';
import { E_Tile, GridScene } from './scenes/grid';
import { TestScene } from './scenes/test';
import { UIScene } from './scenes/ui';
import {
    ENTITY_METADATA,
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityExtendedType,
    getLoopholeEntityPosition,
    OVERLAPPABLE_ENTITY_TYPES,
    TILE_SIZE,
    type LoopholePositionType,
} from '../utils';
import { v4 } from 'uuid';

const SCENES: AvailableScenes = {
    [TestScene.name]: (name) => new TestScene(name),
    [UIScene.name]: (name) => new UIScene(name),
    [GridScene.name]: (name) => new GridScene(name),
};

export type OnLevelChangedCallback = (level: Loophole_Level) => void;

export class LevelEditor extends Engine {
    #onLevelChanged: OnLevelChangedCallback;

    #level: Loophole_LevelWithIDs | null = null;
    #tiles: Record<string, E_Tile> = {};
    #stashedTiles: Record<string, E_Tile> = {};

    constructor(onLevelChanged: OnLevelChangedCallback, options: EngineOptions = {}) {
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

        this.#onLevelChanged = onLevelChanged;
    }

    get level(): Readonly<Loophole_Level | null> {
        if (!this.#level) {
            return null;
        }

        return {
            ...this.#level,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            entities: this.#level.entities.map(({ id, ...rest }) => ({ ...rest })),
        };
    }

    set level(level: Loophole_Level) {
        this.#level = this.#addIDsToLevel(level);

        for (const tile of Object.values(this.#tiles)) {
            this.#stashTile(tile);
        }

        for (const entity of this.#level.entities) {
            const tile = this.#claimOrCreateTile(entity);
            tile.setEnabled(true);
            tile.entity = entity;
        }
    }

    override _update() {
        const updated = true;

        return updated;
    }

    placeTile(
        position: Loophole_Int2,
        entityType: Loophole_ExtendedEntityType,
        edgeAlignment: Loophole_EdgeAlignment | null,
        rotation: Loophole_Rotation,
        flipDirection: boolean,
    ) {
        if (!this.#level) {
            return;
        }

        const { createEntity, positionType, type } = ENTITY_METADATA[entityType];
        this.#removeOverlappingTiles(position, positionType, type, edgeAlignment || 'RIGHT');

        const entity = {
            ...createEntity(position, edgeAlignment, rotation, flipDirection),
            id: v4(),
        };
        console.log(entity);
        this.#level.entities.push(entity);

        this.#saveTileChange();
    }

    removeEntity(entity: Loophole_Entity) {
        const position = getLoopholeEntityPosition(entity);
        const extendedType = getLoopholeEntityExtendedType(entity);
        const { type, positionType } = ENTITY_METADATA[extendedType];
        const edgeAlignment = getLoopholeEntityEdgeAlignment(entity);

        return this.removeTile(position, positionType, type, edgeAlignment);
    }

    removeTile(
        position: Loophole_Int2,
        positionType: LoopholePositionType,
        entityType: Loophole_EntityType,
        edgeAlignment: Loophole_EdgeAlignment,
    ) {
        this.#removeOverlappingTiles(position, positionType, entityType, edgeAlignment);
        this.#saveTileChange();
    }

    #stashTile(tile: E_Tile) {
        this.#stashedTiles[tile.id] = tile;
        delete this.#tiles[tile.id];
    }

    #addIDsToLevel(level: Loophole_Level): Loophole_LevelWithIDs {
        return {
            ...level,
            entities: level.entities.map((entity) => ({
                ...entity,
                id: v4(),
            })),
        };
    }

    #claimOrCreateTile(entity: Loophole_EntityWithID): E_Tile {
        const tile = this.#tiles[entity.id] ?? this.#stashedTiles[entity.id] ?? null;
        if (tile) {
            return tile;
        }

        const newTile = new E_Tile(this, entity).setScale({ x: TILE_SIZE, y: TILE_SIZE });
        this.addSceneEntities(GridScene.name, newTile);

        return newTile;
    }

    #removeOverlappingTiles(
        position: Loophole_Int2,
        positionType: LoopholePositionType,
        entityType: Loophole_EntityType,
        edgeAlignment: Loophole_EdgeAlignment,
    ) {
        if (!this.#level) {
            return;
        }

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

            if (
                OVERLAPPABLE_ENTITY_TYPES.some(
                    ([type1, type2]) =>
                        (type1 === entityType && type2 === type) ||
                        (type2 === entityType && type1 === type),
                )
            ) {
                return true;
            }

            if ('edgePosition' in entity && entity.edgePosition.alignment !== edgeAlignment) {
                return true;
            }

            return false;
        });
    }

    #saveTileChange() {
        const level = this.level;
        if (level) {
            this.#onLevelChanged(level);
        }
    }
}
