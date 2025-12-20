import { Engine, type EngineOptions } from '../engine';
import {
    MAX_ENTITY_COUNT,
    MAX_POSITION,
    MIN_POSITION,
    type Loophole_EdgeAlignment,
    type Loophole_EntityType,
    type Loophole_EntityWithID,
    type Loophole_Exit,
    type Loophole_ExtendedEntityType,
    type Loophole_Int2,
    type Loophole_InternalLevel,
    type Loophole_Rotation,
    type WithID,
} from './externalLevelSchema';
import { E_Tile, GridScene } from './scenes/grid';
import { UIScene } from './scenes/ui';
import {
    calculateLevelBoundingBox,
    calculateLevelCameraTarget,
    COLOR_PALETTE_METADATA,
    convertLoopholeTypeToExtendedType,
    degreesToLoopholeRotation,
    ENTITY_METADATA,
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityExtendedType,
    getLoopholeEntityPosition,
    getLoopholeEntityPositionType,
    getLoopholeExplosionPosition,
    getLoopholeExplosionStartPosition,
    Loophole_ColorPalette,
    loopholePositionToEnginePosition,
    loopholeRotationToDegrees,
    OVERLAPPABLE_ENTITY_TYPES,
    TILE_SIZE,
    WIRE_CORNER_SPRITE,
    type LoopholePositionType,
} from '../utils';
import { v4 } from 'uuid';
import { getAppStore, getSettingsStore } from '../stores';
import { Vector, type IVector } from '../engine/math';
import type { BoundingBox } from '../engine/types';
import { boundingBoxesIntersect } from '../engine/utils';

const MAX_STASHED_TILES = 10_000;

export type OnLevelChangedCallback = (level: Loophole_InternalLevel) => void;
export type OnLevelInViewportChangedCallback = (inViewport: boolean) => void;

type EditAction =
    | {
          type: 'place';
          entity: Loophole_EntityWithID;
      }
    | {
          type: 'remove';
          entity: Loophole_EntityWithID;
      }
    | {
          type: 'update';
          oldEntity: Loophole_EntityWithID;
          newEntity: Loophole_EntityWithID;
      };
type EditActionGroup = {
    actions: EditAction[];
    hash: string;
};

export interface LevelEditorOptions extends EngineOptions {
    onLevelChanged?: OnLevelChangedCallback;
}

export class LevelEditor extends Engine<LevelEditorOptions> {
    #level: Loophole_InternalLevel | null = null;
    #exitEntity: (Loophole_Exit & WithID) | null = null;
    #tiles: Record<string, E_Tile> = {};
    #stashedTiles: Record<string, E_Tile> = {};
    #levelID: string | null = null;
    #colorPalette: Loophole_ColorPalette | null = null;

    #undoStack: EditActionGroup[] = [];
    #redoStack: EditActionGroup[] = [];
    #colorPaletteChangedListeners: Map<string, (palette: Loophole_ColorPalette) => void> =
        new Map();

    #levelBoundingBox: BoundingBox | null = null;
    #levelBoundingBoxDirty: boolean = true;

    constructor(options: Partial<LevelEditorOptions> = {}) {
        super({
            startScenes: [GridScene, UIScene],
            minZoom: -3,
            maxZoom: 0.5,
            cameraDrag: true,
            clearColor: 'transparent',
            keysToCapture: [
                { key: 'z', ctrl: true },
                { key: 'z', meta: true },
                { key: 'y', ctrl: true },
                { key: 'y', meta: true },
                { key: 'a', meta: true },
                { key: 'f', meta: true },
                { key: 'k', meta: true },
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
                [WIRE_CORNER_SPRITE]: 'pixel/wire-corner.png',
                ...Object.fromEntries(
                    Object.values(Loophole_ColorPalette).map((palette) => [
                        `wall-${palette}`,
                        COLOR_PALETTE_METADATA[palette].wallImage,
                    ]),
                ),
                ...options.images,
            },
        });
    }

    get level(): Readonly<Loophole_InternalLevel | null> {
        return this.#level;
    }

    set level(level: Loophole_InternalLevel) {
        this.#level = level;
        this.#undoStack = [];
        this.#redoStack = [];

        for (const tile of Object.values(this.#tiles)) {
            this.#stashTile(tile);
        }
        for (const entity of this.#level.entities) {
            this.#placeEntity(entity, false);
        }

        const entranceTile = this.#placeEntity(this.#level.entrance, false);
        entranceTile.variant = 'entrance';

        this.#exitEntity = {
            entityType: 'EXIT',
            position: this.#level.exitPosition,
            tID: v4(),
        };
        const exitTile = this.#placeEntity(this.#exitEntity, false);
        exitTile.variant = 'exit';

        for (const explosion of this.#level.explosions) {
            const explosionTile = this.#placeEntity(
                { ...explosion, entityType: 'EXPLOSION' },
                false,
            );
            explosionTile.variant = 'explosion';
        }

        if (level?.id !== this.#levelID) {
            const camera = calculateLevelCameraTarget(level);
            this.setCamera(camera);
            this.#levelID = level.id;
        }

        getAppStore().setSelectedTiles([]);
        this.forceRender();
        this.#levelBoundingBoxDirty = true;
    }

    get tiles(): Readonly<Record<string, E_Tile>> {
        return this.#tiles;
    }

    get entityCount(): number {
        return Object.keys(this.#tiles).length;
    }

    get colorPalette(): Loophole_ColorPalette | null {
        return this.#colorPalette;
    }

    get levelBoundingBox(): BoundingBox {
        if (this.#levelBoundingBox && !this.#levelBoundingBoxDirty) {
            return this.#levelBoundingBox;
        }

        if (!this.#level) {
            return {
                x1: 0,
                x2: 0,
                y1: 0,
                y2: 0,
            };
        }

        this.#levelBoundingBox = calculateLevelBoundingBox(this.#level, true);
        this.#levelBoundingBoxDirty = false;
        return this.#levelBoundingBox;
    }

    addColorPaletteChangedListener(id: string, listener: (palette: Loophole_ColorPalette) => void) {
        this.#colorPaletteChangedListeners.set(id, listener);
        if (this.#colorPalette) {
            listener(this.#colorPalette);
        }
    }

    removeColorPaletteChangedListener(id: string) {
        this.#colorPaletteChangedListeners.delete(id);
    }

    override update(): boolean {
        const {
            cameraTarget,
            setCameraTarget,
            levels,
            activeLevelID,
            levelInViewport,
            setLevelInViewport,
        } = getAppStore();
        if (cameraTarget) {
            this.cameraTarget = cameraTarget;
            setCameraTarget(null);
        }

        if (this.getKey('-').pressed) {
            this.zoomCamera(-0.4 / this.options.zoomSpeed);
        }
        if (this.getKey('=').pressed) {
            this.zoomCamera(0.4 / this.options.zoomSpeed);
        }

        const level = levels[activeLevelID];
        const colorPalette = level?.colorPalette;
        if (colorPalette !== undefined && colorPalette !== this.#colorPalette) {
            this.#colorPaletteChangedListeners.forEach((listener) => listener(colorPalette));
            this.forceRender();
            this.#colorPalette = colorPalette;
        }

        const currentLevelInViewport = boundingBoxesIntersect(
            this._cameraSystem.boundingBox,
            this.levelBoundingBox,
        );
        if (currentLevelInViewport !== levelInViewport) {
            setLevelInViewport(currentLevelInViewport);
        }

        const { showEngineStats, setUserSettings } = getSettingsStore();
        if (this.getKey('k').pressed && this.getKey('k').meta) {
            setUserSettings({ showEngineStats: !showEngineStats });
        }

        if (this.options.debugOverlayEnabled != showEngineStats) {
            this.options = {
                ...this.options,
                debugOverlayEnabled: showEngineStats,
                alwaysRender: showEngineStats,
            };
        }

        return false;
    }

    calculateTilePositionFromWorld(
        worldPosition: IVector<number>,
        entityType: Loophole_ExtendedEntityType,
    ): {
        position: Loophole_Int2;
        edgeAlignment: Loophole_EdgeAlignment | null;
        rotation: number;
    } {
        let cursorPosition: Vector;
        let edgeAlignment: Loophole_EdgeAlignment | null = null;
        let rotation: number = 0;

        const { positionType } = ENTITY_METADATA[entityType];
        if (positionType === 'CELL') {
            cursorPosition = new Vector(
                Math.round(worldPosition.x / TILE_SIZE),
                Math.round(worldPosition.y / TILE_SIZE),
            );
            rotation = 0;
        } else {
            const cellX = Math.round(worldPosition.x / TILE_SIZE);
            const cellY = Math.round(worldPosition.y / TILE_SIZE);
            const localX = worldPosition.x - cellX * TILE_SIZE;
            const localY = worldPosition.y - cellY * TILE_SIZE;

            if (Math.abs(localX) > Math.abs(localY)) {
                cursorPosition = new Vector(localX > 0 ? cellX + 0.5 : cellX - 0.5, cellY);
                edgeAlignment = 'RIGHT';
                rotation = loopholeRotationToDegrees('RIGHT');
            } else {
                cursorPosition = new Vector(cellX, localY > 0 ? cellY + 0.5 : cellY - 0.5);
                edgeAlignment = 'TOP';
                rotation = loopholeRotationToDegrees('UP');
            }
        }

        const tilePosition = loopholePositionToEnginePosition({
            x: cursorPosition.x,
            y: cursorPosition.y,
        });
        tilePosition.floorMut();

        const position: Loophole_Int2 = {
            x: Math.max(MIN_POSITION.x, Math.min(MAX_POSITION.x, tilePosition.x)),
            y: Math.max(MIN_POSITION.y, Math.min(MAX_POSITION.y, tilePosition.y)),
        };

        return { position, edgeAlignment, rotation };
    }

    handleDrop(
        screenX: number,
        screenY: number,
        entityType: Loophole_ExtendedEntityType,
    ): E_Tile[] {
        const worldPosition = this.screenToWorld({
            x: screenX,
            y: screenY,
        });
        const { position, edgeAlignment } = this.calculateTilePositionFromWorld(
            worldPosition,
            entityType,
        );

        const { brushEntityRotation, brushEntityFlipDirection, setSelectedTiles } = getAppStore();
        const tiles = this.placeTile(
            position,
            entityType,
            edgeAlignment,
            brushEntityRotation,
            brushEntityFlipDirection,
        );
        setSelectedTiles(tiles);
        return tiles;
    }

    canPlaceEntity(entityType: Loophole_ExtendedEntityType | null): boolean {
        const { lockedLayers } = getAppStore();
        return this.entityCount < MAX_ENTITY_COUNT && (!entityType || !lockedLayers[entityType]);
    }

    placeTile(
        position: Loophole_Int2,
        entityType: Loophole_ExtendedEntityType,
        edgeAlignment: Loophole_EdgeAlignment | null,
        rotation: Loophole_Rotation,
        flipDirection: boolean,
        hash?: string | null,
    ): E_Tile[] {
        if (!this.canPlaceEntity(entityType)) {
            const { selectedTiles } = getAppStore();
            return Array.from(Object.values(selectedTiles));
        }

        const { createEntity, positionType } = ENTITY_METADATA[entityType];
        if (this.#overlapsCriticalTile(entityType, position, positionType, edgeAlignment)) {
            return [];
        }

        return this.#performEditActions({
            actions: [
                {
                    type: 'place',
                    entity: {
                        ...createEntity(position, edgeAlignment, rotation, flipDirection),
                        tID: v4(),
                    },
                },
            ],
            hash: hash || v4(),
        });
    }

    removeLoopholeEntities(entities: Loophole_EntityWithID[], hash?: string | null): E_Tile[] {
        const tiles = entities.map((entity) => ({
            tID: entity.tID,
            position: getLoopholeEntityPosition(entity),
            positionType: getLoopholeEntityPositionType(entity),
            entityType: entity.entityType,
            edgeAlignment: getLoopholeEntityEdgeAlignment(entity),
        }));

        return this.removeTiles(tiles, hash);
    }

    removeTiles(
        tiles: {
            tID?: string;
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
        offset: IVector<number>,
        hash?: string | null,
    ): E_Tile[] {
        return this.#applyEntityTransformation(
            entities,
            (entity) => {
                const newEntity = { ...entity };
                if ('edgePosition' in newEntity) {
                    newEntity.edgePosition = {
                        ...newEntity.edgePosition,
                        cell: {
                            x: newEntity.edgePosition.cell.x + offset.x,
                            y: newEntity.edgePosition.cell.y + offset.y,
                        },
                    };
                } else if ('position' in newEntity) {
                    newEntity.position = {
                        x: newEntity.position.x + offset.x,
                        y: newEntity.position.y + offset.y,
                    };
                } else {
                    const newPosition = getLoopholeExplosionPosition(newEntity, offset);
                    newEntity.startPosition = getLoopholeExplosionStartPosition(
                        newEntity,
                        newPosition,
                    );
                }
                return newEntity;
            },
            hash,
        );
    }

    updateEntities(
        entities: Loophole_EntityWithID[],
        updatedProperties: Partial<Loophole_EntityWithID> | Partial<Loophole_EntityWithID>[],
        hash?: string | null,
    ): E_Tile[] {
        return this.#applyEntityTransformation(
            entities,
            (entity, i) => {
                const props = Array.isArray(updatedProperties)
                    ? updatedProperties[i]
                    : updatedProperties;
                return { ...entity, ...props } as Loophole_EntityWithID;
            },
            hash,
        );
    }

    rotateEntities(
        entities: Loophole_EntityWithID[],
        centerPosition: IVector<number>,
        rotation: 90 | -90,
        hash?: string | null,
    ): E_Tile[] {
        return this.#applyEntityTransformation(
            entities,
            (entity) => {
                let newEntity = entity;
                const positionType = getLoopholeEntityPositionType(entity);
                const position = getLoopholeEntityPosition(entity);

                if (positionType === 'CELL') {
                    if ('position' in entity) {
                        if ('rotation' in entity) {
                            const currentPos = position;
                            const dx = currentPos.x - centerPosition.x;
                            const dy = currentPos.y - centerPosition.y;

                            const newPosition: Loophole_Int2 =
                                rotation === 90
                                    ? {
                                          x: Math.round(centerPosition.x - dy),
                                          y: Math.round(centerPosition.y + dx),
                                      }
                                    : {
                                          x: Math.round(centerPosition.x + dy),
                                          y: Math.round(centerPosition.y - dx),
                                      };

                            const currentDegrees = loopholeRotationToDegrees(entity.rotation);
                            const newDegrees = (currentDegrees - rotation + 360) % 360;
                            newEntity = {
                                ...entity,
                                position: newPosition,
                                rotation: degreesToLoopholeRotation(newDegrees),
                            };
                        }
                    } else if ('startPosition' in entity) {
                        const currentDegrees = loopholeRotationToDegrees(entity.direction);
                        const newDegrees = (currentDegrees - rotation + 360) % 360;
                        const cellPos = new Vector(
                            Math.round(centerPosition.x),
                            Math.round(centerPosition.y),
                        );
                        newEntity = {
                            ...entity,
                            startPosition:
                                entity.direction === 'RIGHT' || entity.direction === 'LEFT'
                                    ? cellPos.y
                                    : cellPos.x,
                            direction: degreesToLoopholeRotation(newDegrees),
                        };
                    } else {
                        return null;
                    }
                } else if ('edgePosition' in entity) {
                    const edgePos = entity.edgePosition;

                    const worldX = edgePos.cell.x + (edgePos.alignment === 'RIGHT' ? 0.5 : 0);
                    const worldY = edgePos.cell.y + (edgePos.alignment === 'TOP' ? 0.5 : 0);

                    const dx = worldX - centerPosition.x;
                    const dy = worldY - centerPosition.y;

                    const newWorldX =
                        rotation === 90 ? centerPosition.x - dy : centerPosition.x + dy;
                    const newWorldY =
                        rotation === 90 ? centerPosition.y + dx : centerPosition.y - dx;

                    const newAlignment: Loophole_EdgeAlignment =
                        edgePos.alignment === 'RIGHT' ? 'TOP' : 'RIGHT';

                    const newCellX = Math.round(newWorldX - (newAlignment === 'RIGHT' ? 0.5 : 0));
                    const newCellY = Math.round(newWorldY - (newAlignment === 'TOP' ? 0.5 : 0));

                    newEntity = {
                        ...entity,
                        edgePosition: {
                            cell: { x: newCellX, y: newCellY },
                            alignment: newAlignment,
                        },
                    };
                } else {
                    return null;
                }

                return newEntity;
            },
            hash,
        );
    }

    #applyEntityTransformation(
        entities: Loophole_EntityWithID[],
        transform: (entity: Loophole_EntityWithID, index: number) => Loophole_EntityWithID | null,
        hash?: string | null,
    ): E_Tile[] {
        const group: EditActionGroup = {
            actions: [],
            hash: hash || v4(),
        };

        const entityIDs = new Set<string>(entities.map((e) => e.tID));
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const position = getLoopholeEntityPosition(entity);
            const positionType = getLoopholeEntityPositionType(entity);
            const edgeAlignment = getLoopholeEntityEdgeAlignment(entity);
            const isEntrance = this.#level?.entrance.tID === entity.tID;
            const isCritical =
                isEntrance ||
                this.#overlapsCriticalTile(
                    entity.entityType,
                    position,
                    positionType,
                    edgeAlignment,
                    entityIDs,
                );

            const newEntity = transform(entity, i);

            if (!newEntity) {
                continue;
            }

            const newPosition = getLoopholeEntityPosition(newEntity);
            const newPositionType = getLoopholeEntityPositionType(newEntity);
            const newEdgeAlignment = getLoopholeEntityEdgeAlignment(newEntity);

            if (
                isCritical ||
                !this.#overlapsCriticalTile(
                    newEntity.entityType,
                    newPosition,
                    newPositionType,
                    newEdgeAlignment,
                    entityIDs,
                )
            ) {
                group.actions.push({ type: 'update', oldEntity: entity, newEntity: newEntity });
            } else {
                group.actions.push({ type: 'remove', entity });
            }
        }

        return this.#performEditActions(group);
    }

    #performEditActions(actions: EditActionGroup, updateStacks: boolean = true): E_Tile[] {
        if (actions.actions.length === 0) {
            return [];
        }

        const affectedTiles: E_Tile[] = [];
        const removedIDs = new Set<string>();
        const placedEntities = new Map<string, Loophole_EntityWithID>();
        for (const action of actions.actions) {
            switch (action.type) {
                case 'place': {
                    const tile = this.#placeEntity(action.entity);
                    affectedTiles.push(tile);
                    placedEntities.set(action.entity.tID, action.entity);
                    if (removedIDs.has(action.entity.tID)) {
                        delete this.#stashedTiles[action.entity.tID];
                        removedIDs.delete(action.entity.tID);
                    }

                    break;
                }
                case 'remove': {
                    this.#removeEntity(action.entity);
                    removedIDs.add(action.entity.tID);
                    placedEntities.delete(action.entity.tID);

                    break;
                }
                case 'update': {
                    const tile = this.#updateEntity(action.newEntity);
                    affectedTiles.push(tile);
                    placedEntities.set(action.newEntity.tID, action.newEntity);

                    break;
                }
            }
        }

        for (const entity of placedEntities.values()) {
            const overlappingEntities = this.#getOverlappingEntities(
                getLoopholeEntityPosition(entity),
                getLoopholeEntityPositionType(entity),
                entity.entityType,
                getLoopholeEntityEdgeAlignment(entity) || 'RIGHT',
            );

            for (const overlappingEntity of overlappingEntities) {
                if (!placedEntities.has(overlappingEntity.tID)) {
                    actions.actions.push({ type: 'remove', entity: overlappingEntity });
                    this.#removeEntity(overlappingEntity);
                    removedIDs.add(overlappingEntity.tID);
                }
            }
        }

        getAppStore().deselectEntities(Array.from(removedIDs));

        if (updateStacks) {
            this.#undoStack.push(actions);
            this.#redoStack = [];
        }

        const level = this.level;
        if (level) {
            this.options.onLevelChanged?.(level);
        }

        this.forceRender();

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
                    case 'update':
                        return {
                            type: 'update',
                            oldEntity: { ...action.newEntity },
                            newEntity: { ...action.oldEntity },
                        };
                }
            })
            .reverse();
    }

    #updateEntity(entity: Loophole_EntityWithID, updateLevel: boolean = true) {
        const tile = this.#tiles[entity.tID];
        if (tile) {
            tile.entity = entity;
        }

        if (this.#level && updateLevel) {
            if (entity.tID === this.#level.entrance.tID && entity.entityType === 'TIME_MACHINE') {
                this.#level.entrance = entity;
            } else if (
                this.#exitEntity &&
                entity.tID === this.#exitEntity.tID &&
                entity.entityType === 'EXIT'
            ) {
                this.#exitEntity = entity;
                this.#level.exitPosition = entity.position;
            } else if (entity.entityType === 'EXPLOSION') {
                const index = this.#level.explosions.findIndex((e) => e.tID === entity.tID);
                if (index !== -1) {
                    this.#level.explosions[index] = entity;
                }
            } else {
                const index = this.#level.entities.findIndex((e) => e.tID === entity.tID);
                if (index !== -1) {
                    this.#level.entities[index] = entity;
                }
            }
        }

        return tile;
    }

    #placeEntity(entity: Loophole_EntityWithID, updateLevel: boolean = true) {
        const tile = this.#claimOrCreateTile(entity);
        tile.entity = entity;
        tile.setEnabled(true);
        if (this.#level && updateLevel) {
            if (entity.tID === this.#level.entrance.tID && entity.entityType === 'TIME_MACHINE') {
                this.#level.entrance = entity;
            } else if (entity.tID === this.#exitEntity?.tID && entity.entityType === 'EXIT') {
                this.#exitEntity = entity;
                this.#level.exitPosition = entity.position;
            } else if (entity.entityType === 'EXPLOSION') {
                this.#level.explosions.push(entity);
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
            if (entity.entityType === 'EXPLOSION') {
                this.#level.explosions = this.#level.explosions.filter((e) => e.tID !== entity.tID);
            } else {
                this.#level.entities = this.#level.entities.filter((e) => e.tID !== entity.tID);
            }
        }
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

        const newTile = (this as LevelEditor).addEntities(E_Tile, {
            entity,
            scene: GridScene.name,
            scale: TILE_SIZE,
        });
        this.#tiles[entity.tID] = newTile;

        return newTile;
    }

    #stashTile(tile: E_Tile) {
        const id = tile.entity.tID;
        if (
            tile.canBeReused &&
            Object.keys(this.#stashedTiles).length < MAX_STASHED_TILES &&
            !this.#stashedTiles[id]
        ) {
            tile.stashTile();
            this.#stashedTiles[id] = tile;
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
        const isTimeMachine = entityType === 'TIME_MACHINE';

        return [...this.#level.entities, ...this.#level.explosions].filter((entity) => {
            const {
                tileOwnership,
                positionType: entityPositionType,
                type,
            } = ENTITY_METADATA[getLoopholeEntityExtendedType(entity)];
            const otherIsTimeMachine = entity.entityType === 'TIME_MACHINE';
            if (!isTimeMachine && !otherIsTimeMachine && entityPositionType !== positionType) {
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
            const alignment = getLoopholeEntityEdgeAlignment(entity);
            if (isTimeMachine && this.#overlapsTimeMachine(entityPos, alignment, position)) {
                return true;
            }
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

            if (alignment && alignment !== edgeAlignment) {
                return false;
            }

            return true;
        });
    }

    #overlapsCriticalTile(
        entityType: Loophole_EntityType | Loophole_ExtendedEntityType,
        position: Loophole_Int2,
        positionType: LoopholePositionType,
        alignment: Loophole_EdgeAlignment | null,
        entityIDs?: Set<string>,
    ): boolean {
        if (entityType === 'EXPLOSION') {
            return false;
        }

        if (this.#level) {
            if (
                positionType === 'CELL' &&
                position.x === this.#level.exitPosition.x &&
                position.y === this.#level.exitPosition.y
            ) {
                return true;
            }

            for (const e of [this.#level.entrance, ...this.#level.entities].filter(
                (e) => e.entityType === 'TIME_MACHINE',
            )) {
                if (
                    entityIDs?.has(e.tID) ||
                    !this.#overlapsTimeMachine(position, alignment, e.position)
                ) {
                    continue;
                }
                return true;
            }
        }

        return false;
    }

    #overlapsTimeMachine(
        position: Loophole_Int2,
        alignment: Loophole_EdgeAlignment | null,
        timeMachinePos: Loophole_Int2,
    ) {
        return (
            (position.x === timeMachinePos.x && position.y === timeMachinePos.y) ||
            (alignment === 'RIGHT' &&
                position.x + 1 === timeMachinePos.x &&
                position.y === timeMachinePos.y) ||
            (alignment === 'TOP' &&
                position.x === timeMachinePos.x &&
                position.y + 1 === timeMachinePos.y)
        );
    }
}
