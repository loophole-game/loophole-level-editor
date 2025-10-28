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

const MAX_STASHED_TILES = 50;

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

export class LevelEditor extends Engine {
    #onLevelChanged: OnLevelChangedCallback;

    #level: Loophole_LevelWithIDs | null = null;
    #tiles: Record<string, E_Tile> = {};
    #stashedTiles: Record<string, E_Tile> = {};

    #undoStack: EditAction[][] = [];
    #redoStack: EditAction[][] = [];

    constructor(onLevelChanged: OnLevelChangedCallback, options: EngineOptions = {}) {
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
        this.#undoStack = [];
        this.#redoStack = [];

        for (const tile of Object.values(this.#tiles)) {
            this.#stashTile(tile);
        }

        for (const entity of this.#level.entities) {
            this.#placeEntity(entity, false);
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
        const { createEntity, positionType, type } = ENTITY_METADATA[entityType];
        const overlappingEntities = this.#getOverlappingEntities(
            position,
            positionType,
            type,
            edgeAlignment || 'RIGHT',
        );
        this.#performEditActions([
            {
                type: 'place',
                entity: {
                    ...createEntity(position, edgeAlignment, rotation, flipDirection),
                    id: v4(),
                },
            },
            ...overlappingEntities.map((entity) => ({ type: 'remove', entity }) as EditAction),
        ]);
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
        edgeAlignment: Loophole_EdgeAlignment | null,
    ) {
        const overlappingEntities = this.#getOverlappingEntities(
            position,
            positionType,
            entityType,
            edgeAlignment,
        );
        this.#performEditActions(overlappingEntities.map((entity) => ({ type: 'remove', entity })));
    }

    undo() {
        if (this.#undoStack.length === 0) {
            return;
        }

        const actions = this.#undoStack.pop()!;
        const reversedActions = this.#reverseActions(actions);
        this.#performEditActions(reversedActions, false);
        this.#redoStack.push(actions);
    }

    redo() {
        if (this.#redoStack.length === 0) {
            return;
        }

        const actions = this.#redoStack.pop()!;
        this.#performEditActions(actions, false);
        this.#undoStack.push(actions);
    }

    #performEditActions(actions: EditAction[], updateStacks: boolean = true) {
        if (actions.length === 0) {
            return;
        }

        for (const action of actions) {
            switch (action.type) {
                case 'place': {
                    this.#placeEntity(action.entity);
                    break;
                }
                case 'remove': {
                    this.#removeEntity(action.entity);
                    break;
                }
            }
        }

        if (updateStacks) {
            this.#undoStack.push(actions);
            this.#redoStack = [];
        }

        this.#saveTileChange();
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
            this.#level.entities.push(entity);
        }

        return tile;
    }

    #removeEntity(entity: Loophole_EntityWithID, updateLevel: boolean = true) {
        const tile = this.#tiles[entity.id];
        if (tile) {
            this.#stashTile(tile);
            tile.setEnabled(false);
        }
        if (this.#level && updateLevel) {
            this.#level.entities = this.#level.entities.filter((e) => e.id !== entity.id);
        }

        return tile;
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
        this.#tiles[entity.id] = newTile;
        this.addSceneEntities(GridScene.name, newTile);

        return newTile;
    }

    #stashTile(tile: E_Tile) {
        const id = tile.id;
        if (Object.keys(this.#stashedTiles).length < MAX_STASHED_TILES) {
            this.#stashedTiles[id] = tile;
            tile.setEnabled(false);
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

        return this.#level.entities.filter((entity) => {
            const {
                tileOwnership,
                positionType: entityPositionType,
                type,
            } = ENTITY_METADATA[getLoopholeEntityExtendedType(entity)];
            if (entityPositionType !== positionType) {
                return false;
            }

            if (tileOwnership === 'ONLY_TYPE_IN_TILE' && entityType !== type) {
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

    #saveTileChange() {
        const level = this.level;
        if (level) {
            this.#onLevelChanged(level);
        }
    }
}
