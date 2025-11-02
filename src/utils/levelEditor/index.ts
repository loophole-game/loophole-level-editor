import { Engine, type EngineOptions } from '../engine';
import type { AvailableScenes } from '../engine/systems/scene';
import type {
    Loophole_EdgeAlignment,
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
    convertLoopholeTypeToExtendedType,
    ENTITY_METADATA,
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityExtendedType,
    getLoopholeEntityPosition,
    getLoopholeEntityPositionType,
    OVERLAPPABLE_ENTITY_TYPES,
    TILE_SIZE,
    type LoopholePositionType,
} from '../utils';
import { v4 } from 'uuid';
import { getAppStore } from '../store';
import { positionsEqual } from '../engine/utils';

const MAX_STASHED_TILES = 10_000;

const SCENES: AvailableScenes = {
    [TestScene.name]: (name) => new TestScene(name),
    [UIScene.name]: (name) => new UIScene(name),
    [GridScene.name]: (name) => new GridScene(name),
};

export type OnLevelChangedCallback = (level: Loophole_Level) => void;

type EditAction =
    | {
          type: 'place';
          entity: Loophole_EntityWithID;
      }
    | {
          type: 'remove';
          entity: Loophole_EntityWithID;
      };
type EditActionGroup = {
    actions: EditAction[];
    hash: string;
};

export class LevelEditor extends Engine {
    #onLevelChanged: OnLevelChangedCallback | null = null;
    #level: Loophole_LevelWithIDs | null = null;
    #tiles: Record<string, E_Tile> = {};
    #stashedTiles: Record<string, E_Tile> = {};

    #undoStack: EditActionGroup[] = [];
    #redoStack: EditActionGroup[] = [];

    constructor(onLevelChanged?: OnLevelChangedCallback, options: EngineOptions = {}) {
        super({
            scenes: SCENES,
            startScenes: [GridScene.name, UIScene.name],
            minZoom: 0.5,
            maxZoom: 2,
            cameraDrag: true,
            clearColor: '#1e2124',
            keysToCapture: [
                { key: 'z', ctrl: true },
                { key: 'z', meta: true },
                { key: 'y', ctrl: true },
                { key: 'y', meta: true },
                { key: 'a', meta: true },
            ],
            ...options,
            images: {
                ...Object.values(ENTITY_METADATA).reduce(
                    (acc, { src, name }) => ({
                        ...acc,
                        [name]: src,
                    }),
                    {},
                ),
                Guy: 'pixel/guy.png',
                ...options.images,
            },
        });

        this.#onLevelChanged = onLevelChanged ?? null;
    }

    get level(): Readonly<Loophole_Level | null> {
        if (!this.#level) {
            return null;
        }

        return {
            ...this.#level,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            entities: this.#level.entities.map(({ tID: id, ...rest }) => ({ ...rest })),
            entrance: {
                entityType: this.#level.entrance.entityType,
                position: this.#level.entrance.position,
                rotation: this.#level.entrance.rotation,
            },
        };
    }

    set level(level: Loophole_Level) {
        this.#level = this.#addIDsToLevel(level);
        this.#undoStack = [];
        this.#redoStack = [];

        for (const tile of Object.values(this.#tiles)) {
            this.#stashTile(tile);
        }

        for (const entity of this.#level.entities) {
            this.#placeEntity(entity, false);
        }
        const entranceTile = this.#placeEntity(this.#level.entrance, false);
        entranceTile.isEntrance = true;

        getAppStore().setSelectedTiles([]);
    }

    set onLevelChanged(onLevelChanged: OnLevelChangedCallback) {
        this.#onLevelChanged = onLevelChanged;
    }

    get tiles(): Readonly<Record<string, E_Tile>> {
        return this.#tiles;
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
        hash?: string | null,
    ): E_Tile[] {
        const { createEntity, positionType, type } = ENTITY_METADATA[entityType];
        if (this.#isOverlappingEntrance(position, positionType)) {
            return [];
        }

        const overlappingEntities = this.#getOverlappingEntities(
            position,
            positionType,
            type,
            edgeAlignment || 'RIGHT',
        );

        return this.#performEditActions({
            actions: [
                {
                    type: 'place',
                    entity: {
                        ...createEntity(position, edgeAlignment, rotation, flipDirection),
                        tID: v4(),
                    },
                },
                ...overlappingEntities.map((entity) => ({ type: 'remove', entity }) as EditAction),
            ],
            hash: hash || v4(),
        });
    }

    removeEntities(entities: Loophole_EntityWithID[], hash?: string | null): E_Tile[] {
        const tiles = entities
            .filter((entity) => entity.tID !== this.#level?.entrance.tID)
            .map((entity) => ({
                position: getLoopholeEntityPosition(entity),
                positionType: getLoopholeEntityPositionType(entity),
                entityType: entity.entityType,
                edgeAlignment: getLoopholeEntityEdgeAlignment(entity),
            }));

        return this.removeTiles(tiles, hash);
    }

    removeTiles(
        tiles: {
            position: Loophole_Int2;
            positionType: LoopholePositionType;
            entityType: Loophole_EntityType;
            edgeAlignment: Loophole_EdgeAlignment | null;
        }[],
        hash?: string | null,
    ): E_Tile[] {
        const overlappingEntities: Loophole_EntityWithID[] = [];
        tiles.forEach((tile) => {
            overlappingEntities.push(
                ...this.#getOverlappingEntities(
                    tile.position,
                    tile.positionType,
                    tile.entityType,
                    tile.edgeAlignment,
                ),
            );
        });

        return this.#performEditActions({
            actions: overlappingEntities.map((entity) => ({ type: 'remove', entity })),
            hash: hash || v4(),
        });
    }

    undo() {
        if (this.#undoStack.length === 0) {
            return;
        }

        let hash = '';
        while (this.#undoStack.length > 0) {
            const group = this.#undoStack[this.#undoStack.length - 1];
            if (hash && group.hash !== hash) {
                break;
            }

            const reversedActions = this.#reverseActions(group.actions);
            const affectedTiles = this.#performEditActions(
                { ...group, actions: reversedActions },
                false,
            );
            getAppStore().setSelectedTiles(affectedTiles);
            affectedTiles.forEach((t) => t.syncVisualState());

            this.#undoStack.pop();
            this.#redoStack.push(group);
            hash = group.hash;
        }
    }

    redo() {
        if (this.#redoStack.length === 0) {
            return;
        }

        let hash = '';
        while (this.#redoStack.length > 0) {
            const group = this.#redoStack[this.#redoStack.length - 1];
            if (hash && group.hash !== hash) {
                break;
            }

            const affectedTiles = this.#performEditActions(group, false);
            getAppStore().setSelectedTiles(affectedTiles);
            affectedTiles.forEach((t) => t.syncVisualState());

            this.#redoStack.pop();
            this.#undoStack.push(group);
            hash = group.hash;
        }
    }

    moveEntities(
        entities: Loophole_EntityWithID[],
        offset: { x: number; y: number },
        hash?: string | null,
    ): E_Tile[] {
        const group: EditActionGroup = {
            actions: [],
            hash: hash || v4(),
        };

        for (const entity of entities) {
            group.actions.push({ type: 'remove', entity });

            const newEntity = { ...entity };
            let newPosition: Loophole_Int2;
            if ('edgePosition' in newEntity) {
                newPosition = {
                    x: newEntity.edgePosition.cell.x + offset.x,
                    y: newEntity.edgePosition.cell.y + offset.y,
                };
                newEntity.edgePosition = {
                    ...newEntity.edgePosition,
                    cell: newPosition,
                };
            } else {
                newPosition = {
                    x: newEntity.position.x + offset.x,
                    y: newEntity.position.y + offset.y,
                };
                newEntity.position = newPosition;
            }

            if (
                !this.#isOverlappingEntrance(newPosition, getLoopholeEntityPositionType(newEntity))
            ) {
                const overlappingEntities = this.#getOverlappingEntities(
                    getLoopholeEntityPosition(newEntity),
                    getLoopholeEntityPositionType(newEntity),
                    newEntity.entityType,
                    getLoopholeEntityEdgeAlignment(newEntity) || 'RIGHT',
                );
                group.actions.push(
                    ...overlappingEntities.map(
                        (entity) => ({ type: 'remove', entity }) as EditAction,
                    ),
                );

                group.actions.push({ type: 'place', entity: newEntity });
            }
        }

        return this.#performEditActions(group);
    }

    updateEntities(
        entities: Loophole_EntityWithID[],
        updatedProperties: Partial<Loophole_EntityWithID>,
        hash?: string | null,
    ): E_Tile[] {
        const group: EditActionGroup = {
            actions: [],
            hash: hash || v4(),
        };

        for (const entity of entities) {
            const updatedEntity = { ...entity, ...updatedProperties } as Loophole_EntityWithID;
            group.actions.push({ type: 'remove', entity });
            group.actions.push({ type: 'place', entity: updatedEntity });
        }

        return this.#performEditActions(group);
    }

    rotateEntities(
        _entities: Loophole_EntityWithID[],
        _centerPosition: Loophole_Int2,
        _rotation: 90 | -90,
        hash?: string | null,
    ): E_Tile[] {
        const group: EditActionGroup = {
            actions: [],
            hash: hash || v4(),
        };
        return this.#performEditActions(group);
    }

    #performEditActions(actions: EditActionGroup, updateStacks: boolean = true): E_Tile[] {
        if (actions.actions.length === 0) {
            return [];
        }

        const affectedTiles: E_Tile[] = [];
        const removedIDs = new Set<string>();
        for (const action of actions.actions) {
            switch (action.type) {
                case 'place': {
                    const tile = this.#placeEntity(action.entity);
                    affectedTiles.push(tile);
                    if (removedIDs.has(action.entity.tID)) {
                        delete this.#stashedTiles[action.entity.tID];
                    }
                    break;
                }
                case 'remove': {
                    this.#removeEntity(action.entity);
                    removedIDs.add(action.entity.tID);
                    break;
                }
            }
        }

        //getAppStore().deselectEntities(Array.from(removedIDs));

        if (updateStacks) {
            this.#undoStack.push(actions);
            this.#redoStack = [];
        }

        const level = this.level;
        if (level) {
            this.#onLevelChanged?.(level);
        }

        return affectedTiles;
    }

    #reverseActions(actions: EditAction[]): EditAction[] {
        return actions
            .map((action): EditAction => {
                switch (action.type) {
                    case 'place':
                        return { type: 'remove', entity: { ...action.entity } };
                    case 'remove':
                        return { type: 'place', entity: { ...action.entity } };
                }
            })
            .reverse();
    }

    #placeEntity(entity: Loophole_EntityWithID, updateLevel: boolean = true) {
        const tile = this.#claimOrCreateTile(entity);
        tile.entity = entity;
        tile.setEnabled(true);
        if (this.#level && updateLevel) {
            if (entity.tID === this.#level.entrance.tID && entity.entityType === 'TIME_MACHINE') {
                this.#level.entrance = entity;
            } else {
                this.#level.entities.push(entity);
            }
        }

        return tile;
    }

    #removeEntity(entity: Loophole_EntityWithID, updateLevel: boolean = true) {
        const tile = this.#tiles[entity.tID];
        if (tile) {
            this.#stashTile(tile);
        }
        if (this.#level && updateLevel) {
            this.#level.entities = this.#level.entities.filter((e) => e.tID !== entity.tID);
        }
    }

    #addIDsToLevel(level: Loophole_Level): Loophole_LevelWithIDs {
        return {
            ...level,
            entities: level.entities.map((entity) => ({
                ...entity,
                tID: v4(),
            })),
            entrance: {
                ...level.entrance,
                tID: v4(),
            },
        };
    }

    #claimOrCreateTile(entity: Loophole_EntityWithID): E_Tile {
        const tile = this.#tiles[entity.tID] ?? this.#stashedTiles[entity.tID] ?? null;
        if (tile) {
            if (this.#stashedTiles[entity.tID]) {
                delete this.#stashedTiles[entity.tID];
                this.#tiles[entity.tID] = tile;
            }

            return tile;
        }

        const newTile = new E_Tile(this, entity).setScale(TILE_SIZE);
        this.#tiles[entity.tID] = newTile;
        this.addSceneEntities(GridScene.name, newTile);

        return newTile;
    }

    #stashTile(tile: E_Tile) {
        const id = tile.entity.tID;
        if (Object.keys(this.#stashedTiles).length < MAX_STASHED_TILES && !this.#stashedTiles[id]) {
            this.#stashedTiles[id] = tile;
            tile.stashTile();
        } else {
            tile.destroy();
        }

        delete this.#tiles[id];
    }

    #getOverlappingEntities(
        position: Loophole_Int2,
        positionType: LoopholePositionType,
        entityType: Loophole_EntityType,
        edgeAlignment: Loophole_EdgeAlignment | null,
    ): Loophole_EntityWithID[] {
        if (!this.#level) {
            return [];
        }

        const { tileOwnership: newTileOwnership } =
            ENTITY_METADATA[convertLoopholeTypeToExtendedType(entityType)];

        return this.#level.entities.filter((entity) => {
            const {
                tileOwnership,
                positionType: entityPositionType,
                type,
            } = ENTITY_METADATA[getLoopholeEntityExtendedType(entity)];
            if (entityPositionType !== positionType) {
                return false;
            }

            if (
                newTileOwnership !== 'ONLY_ENTITY_IN_TILE' &&
                tileOwnership === 'ONLY_TYPE_IN_TILE' &&
                entityType !== type
            ) {
                return false;
            }

            const entityPos = getLoopholeEntityPosition(entity);
            if (entityPos.x !== position.x || entityPos.y !== position.y) {
                return false;
            }

            if (
                OVERLAPPABLE_ENTITY_TYPES.some(
                    ([type1, type2]) =>
                        (type1 === entityType && type2 === type) ||
                        (type2 === entityType && type1 === type),
                )
            ) {
                return false;
            }

            if ('edgePosition' in entity && entity.edgePosition.alignment !== edgeAlignment) {
                return false;
            }

            return true;
        });
    }

    #isOverlappingEntrance(position: Loophole_Int2, positionType: LoopholePositionType): boolean {
        if (!this.#level || positionType === 'EDGE') {
            return false;
        }

        const entrance = this.#level.entrance;
        const entrancePos = getLoopholeEntityPosition(entrance);

        return positionsEqual(position, entrancePos);
    }
}
