import {
    calculateSelectionCenter,
    degreesToLoopholeRotation,
    ENTITY_METADATA,
    getLoopholeExplosionPosition,
    getLoopholeExplosionStartPosition,
    loopholeRotationToDegrees,
    TILE_SIZE,
} from '@/utils/utils';
import { Entity, type EntityOptions } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import { getAppStore } from '@/utils/stores';
import {
    MAX_ENTITY_COUNT,
    type Loophole_EdgeAlignment,
    type Loophole_EntityWithID,
    type Loophole_ExtendedEntityType,
    type Loophole_Int2,
    type Loophole_Rotation,
    type Loophole_Wire,
    type WithID,
} from '../externalLevelSchema';
import { PointerButton, type CursorType } from '@/utils/engine/systems/pointer';
import { Vector, type IVector } from '@/utils/engine/math';
import type { LevelEditor } from '..';
import { C_Lerp, C_LerpPosition, C_LerpRotation } from '@/utils/engine/components/Lerp';
import { C_Shape } from '@/utils/engine/components/Shape';
import { E_Tile, E_TileHighlight } from './grid';
import { C_PointerTarget } from '@/utils/engine/components/PointerTarget';
import { v4 } from 'uuid';
import { E_EntityVisual } from '../entityVisual';
import type { C_Drawable } from '@/utils/engine/components';
import type { WebKey } from '@/utils/engine/types';

const multiSelectIsActive = (editor: LevelEditor) => editor.getKey('Shift').down;
const cameraDragIsActive = (editor: LevelEditor) =>
    editor.getPointerButton(PointerButton.RIGHT).down;

const CURSOR_PRIORITY = {
    DEFAULT: 0,
    TILE_HOVER: 5,
    BRUSH: 10,
    HANDLE_HOVER: 20,
    DRAGGING: 30,
} as const;

const WIRE_TURNS: Record<string, Loophole_Rotation> = {
    'RIGHT-UP': 'UP',
    'UP-RIGHT': 'DOWN',
    'RIGHT-DOWN': 'RIGHT',
    'DOWN-RIGHT': 'LEFT',
    'LEFT-DOWN': 'DOWN',
    'DOWN-LEFT': 'UP',
    'LEFT-UP': 'LEFT',
    'UP-LEFT': 'RIGHT',
};

class E_TileCursor extends Entity<LevelEditor> {
    #entityVisual: E_EntityVisual;

    #positionLerp: C_LerpPosition<Vector>;
    #tileOpacityLerp: C_Lerp<number>;
    #tileRotationLerp: C_Lerp<number>;

    #targetPosition: IVector<number> | null = null;
    #targetRotation: number | null = null;
    #active: boolean = false;

    #dragStartTilePosition: Vector | null = null;
    #placedTileDuringDrag: Set<string> = new Set();
    #dragPositionType: 'CELL' | 'EDGE' | null = null;
    #dragEdgeAlignment: Loophole_EdgeAlignment | null = null;
    #dragHash: string | null = null;

    #wireDragPath: IVector<number>[] = [];
    #wirePlacedTiles: Map<string, E_Tile> = new Map();

    #prevBrushEntityType: Loophole_ExtendedEntityType | null = null;

    constructor(options: EntityOptions<LevelEditor>) {
        super({ name: 'cursor', ...options });

        this.#entityVisual = this.addEntities(E_EntityVisual, { mode: 'brush' });
        this.#tileOpacityLerp = this.#entityVisual.addComponents(C_Lerp<number, LevelEditor>, {
            get: () => this.#entityVisual.opacity,
            set: (value: number) => {
                this.#entityVisual.opacity = value;
            },
            speed: 4,
        });

        this.setZIndex(50);
        this.#positionLerp = this.addComponents(C_LerpPosition<Vector, LevelEditor>, {
            target: this,
            speed: 20,
        });
        this.#tileRotationLerp = this.addComponents(C_LerpRotation<LevelEditor>, {
            target: this,
            speed: 1000,
        });
    }

    override update(deltaTime: number): boolean {
        const updated = super.update(deltaTime);

        const {
            brushEntityType,
            brushEntityRotation,
            setBrushEntityRotation,
            brushEntityFlipDirection,
            setBrushEntityFlipDirection,
            setSelectedTiles,
            isMovingTiles,
            isDraggingToPlace,
            setIsDraggingToPlace,
        } = getAppStore();

        if (
            this._engine.pointerState.onScreen &&
            !multiSelectIsActive(this._engine) &&
            !cameraDragIsActive(this._engine) &&
            !isMovingTiles &&
            brushEntityType
        ) {
            if (isDraggingToPlace) {
                this._engine.requestCursor(
                    'tile-cursor-dragging',
                    'grabbing',
                    CURSOR_PRIORITY.DRAGGING,
                );
            } else {
                this._engine.requestCursor('tile-cursor', 'crosshair', CURSOR_PRIORITY.BRUSH);
            }
        }

        if (
            this._engine.pointerState.onScreen &&
            !multiSelectIsActive(this._engine) &&
            !cameraDragIsActive(this._engine) &&
            !isMovingTiles &&
            brushEntityType
        ) {
            const {
                positionType,
                tileScale: tileScaleOverride = 1,
                hasRotation,
                hasFlipDirection,
                type,
                dragPlacementDisabled,
            } = ENTITY_METADATA[brushEntityType];
            this.#entityVisual.onEntityChanged(brushEntityType);

            const {
                position: tilePosition,
                edgeAlignment,
                rotation,
            } = this._engine.calculateTilePositionFromWorld(
                this._engine.pointerState.worldPosition,
                brushEntityType,
            );
            const cursorPosition = {
                x:
                    tilePosition.x +
                    ((this.#dragEdgeAlignment ?? edgeAlignment) === 'RIGHT' ? 0.5 : 0),
                y:
                    tilePosition.y +
                    ((this.#dragEdgeAlignment ?? edgeAlignment) === 'TOP' ? 0.5 : 0),
            };
            if (this.#dragPositionType === 'CELL' || !this.#dragStartTilePosition)
                this.#targetPosition = {
                    x: cursorPosition.x * TILE_SIZE,
                    y: -cursorPosition.y * TILE_SIZE,
                };
            else
                this.#targetPosition =
                    this.#dragEdgeAlignment === 'TOP'
                        ? {
                              x: tilePosition.x * TILE_SIZE,
                              y: -(this.#dragStartTilePosition.y + 0.5) * TILE_SIZE,
                          }
                        : {
                              x: (this.#dragStartTilePosition.x + 0.5) * TILE_SIZE,
                              y: -tilePosition.y * TILE_SIZE,
                          };

            let _brushEntityRotation = brushEntityRotation;
            let _brushEntityFlipDirection = brushEntityFlipDirection;
            if (this._engine.getKey('r').pressed) {
                if (hasRotation) {
                    _brushEntityRotation = degreesToLoopholeRotation(
                        loopholeRotationToDegrees(brushEntityRotation) - 90,
                    );
                    setBrushEntityRotation(_brushEntityRotation);
                } else if (hasFlipDirection) {
                    _brushEntityFlipDirection = !brushEntityFlipDirection;
                    setBrushEntityFlipDirection(_brushEntityFlipDirection);
                }
            }

            this.#targetRotation = rotation;
            if (hasRotation) {
                this.#targetRotation =
                    (this.#targetRotation + loopholeRotationToDegrees(_brushEntityRotation)) % 360;
            } else if (hasFlipDirection && _brushEntityFlipDirection) {
                this.#targetRotation += 180;
            }

            this.setScale(TILE_SIZE * tileScaleOverride);
            if (!this.#active) {
                this.setPosition(this.#targetPosition);
                this.setRotation(this.#targetRotation ?? 0);
            }

            const leftButton = this._engine.getPointerButton(PointerButton.LEFT);
            const rightButton = this._engine.getPointerButton(PointerButton.RIGHT);

            if (leftButton.pressed && !isDraggingToPlace) {
                setIsDraggingToPlace(true);
                this.#dragStartTilePosition = new Vector(tilePosition);
                this.#placedTileDuringDrag.clear();
                this.#dragPositionType = positionType;
                this.#dragEdgeAlignment = edgeAlignment;
                this.#dragHash = v4();

                if (brushEntityType === 'WIRE') {
                    this.#wireDragPath = [{ x: tilePosition.x, y: tilePosition.y }];
                    this.#wirePlacedTiles.clear();
                }

                const tiles = this._engine.placeTile(
                    tilePosition,
                    brushEntityType,
                    edgeAlignment,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                    this.#dragHash,
                );
                setSelectedTiles(tiles);
                this.#placedTileDuringDrag.add(this.#getTileKey(tilePosition, edgeAlignment));

                if (brushEntityType === 'WIRE' && tiles.length > 0) {
                    this.#wirePlacedTiles.set(
                        this.#getTileKey(tilePosition, edgeAlignment),
                        tiles[0],
                    );
                }
            } else if (
                leftButton.down &&
                isDraggingToPlace &&
                this.#dragStartTilePosition &&
                !dragPlacementDisabled
            ) {
                if (brushEntityType === 'WIRE') {
                    this.#handleWireDragPlacement(tilePosition, brushEntityType);
                } else {
                    this.#handleDragPlacement(
                        tilePosition,
                        brushEntityType,
                        brushEntityRotation,
                        brushEntityFlipDirection,
                    );
                }
            } else if (leftButton.released && isDraggingToPlace) {
                setIsDraggingToPlace(false);
                this.#dragStartTilePosition = null;
                this.#placedTileDuringDrag.clear();
                this.#dragPositionType = null;
                this.#dragEdgeAlignment = null;
                this.#wireDragPath = [];
                this.#wirePlacedTiles.clear();
            } else if (leftButton.clicked && !isDraggingToPlace) {
                const tiles = this._engine.placeTile(
                    tilePosition,
                    brushEntityType,
                    edgeAlignment,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                );
                setSelectedTiles(tiles);
                this._engine.capturePointerButtonClick(PointerButton.LEFT);
            }

            if (rightButton.clicked) {
                this._engine.removeTiles([
                    {
                        position: tilePosition,
                        positionType,
                        entityType: type,
                        edgeAlignment,
                    },
                ]);
                this._engine.capturePointerButtonClick(PointerButton.RIGHT);
            }

            this.#active = true;
        } else {
            this.#targetPosition = null;
            this.#active = false;
        }

        const positionTarget = this.#targetPosition || this.position;
        this.#positionLerp.target = new Vector(positionTarget);
        this.#tileOpacityLerp.target =
            this.#active && this._engine.entityCount < MAX_ENTITY_COUNT ? 0.5 : 0;
        if (!isDraggingToPlace) {
            const targetRotation = this.#targetRotation ?? this.rotation;
            if (this.#prevBrushEntityType !== brushEntityType) {
                this.#prevBrushEntityType = brushEntityType;
                this.setRotation(targetRotation);
            }
            this.#tileRotationLerp.target = targetRotation;
        }

        return updated;
    }

    #handleDragPlacement(
        currentTilePosition: IVector<number>,
        brushEntityType: Loophole_ExtendedEntityType,
        brushEntityRotation: Loophole_Rotation,
        brushEntityFlipDirection: boolean,
    ) {
        if (!this.#dragStartTilePosition || !this.#dragPositionType) return;

        const tilesToPlace: IVector<number>[] = [];

        if (this.#dragPositionType === 'CELL') {
            const startX = Math.min(this.#dragStartTilePosition.x, currentTilePosition.x);
            const endX = Math.max(this.#dragStartTilePosition.x, currentTilePosition.x);
            const startY = Math.min(this.#dragStartTilePosition.y, currentTilePosition.y);
            const endY = Math.max(this.#dragStartTilePosition.y, currentTilePosition.y);

            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    tilesToPlace.push({ x, y });
                }
            }
        } else {
            if (this.#dragEdgeAlignment === 'RIGHT') {
                const startY = Math.min(this.#dragStartTilePosition.y, currentTilePosition.y);
                const endY = Math.max(this.#dragStartTilePosition.y, currentTilePosition.y);
                const x = this.#dragStartTilePosition.x;
                for (let y = startY; y <= endY; y++) {
                    tilesToPlace.push({ x, y });
                }
            } else if (this.#dragEdgeAlignment === 'TOP') {
                const startX = Math.min(this.#dragStartTilePosition.x, currentTilePosition.x);
                const endX = Math.max(this.#dragStartTilePosition.x, currentTilePosition.x);
                const y = this.#dragStartTilePosition.y;
                for (let x = startX; x <= endX; x++) {
                    tilesToPlace.push({ x, y });
                }
            }
        }

        const allPlacedTiles: E_Tile[] = [];
        const edgeAlignment = this.#dragEdgeAlignment ?? null;

        for (const pos of tilesToPlace) {
            const key = this.#getTileKey(pos, edgeAlignment);
            if (!this.#placedTileDuringDrag.has(key)) {
                const tiles = this._engine.placeTile(
                    pos,
                    brushEntityType,
                    edgeAlignment,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                    this.#dragHash,
                );
                allPlacedTiles.push(...tiles);
                this.#placedTileDuringDrag.add(key);
            }
        }

        if (allPlacedTiles.length > 0) {
            const { selectedTiles, setSelectedTiles } = getAppStore();
            setSelectedTiles([...Object.values(selectedTiles), ...allPlacedTiles]);
        }
    }

    #getTileKey(position: IVector<number>, edgeAlignment: Loophole_EdgeAlignment | null): string {
        return `${position.x},${position.y},${edgeAlignment ?? 'NONE'}`;
    }

    #handleWireDragPlacement(
        currentTilePosition: IVector<number>,
        brushEntityType: Loophole_ExtendedEntityType,
    ) {
        if (!this.#dragStartTilePosition) return;

        const lastPos = this.#wireDragPath[this.#wireDragPath.length - 1];
        if (lastPos && lastPos.x === currentTilePosition.x && lastPos.y === currentTilePosition.y) {
            return;
        }

        this.#wireDragPath.push({ x: currentTilePosition.x, y: currentTilePosition.y });

        const wireConfigs = this.#calculateWireConfigs(this.#wireDragPath);

        const pos = currentTilePosition;
        const config = wireConfigs[wireConfigs.length - 1];
        const key = this.#getTileKey(pos, null);
        const { selectedTiles, setSelectedTiles } = getAppStore();

        if (!this.#placedTileDuringDrag.has(key)) {
            const tiles = this._engine.placeTile(
                pos,
                brushEntityType,
                null,
                config.rotation,
                false,
                this.#dragHash,
            );

            if (tiles.length > 0) {
                const wireEntity = tiles[0].entity as Loophole_Wire & WithID;
                wireEntity.sprite = config.sprite;
                tiles[0].entity = wireEntity;
                tiles[0].syncVisualState();

                this.#wirePlacedTiles.set(key, tiles[0]);
                this.#placedTileDuringDrag.add(key);
                setSelectedTiles([...Object.values(selectedTiles), tiles[0]]);
            }
        }

        if (this.#wireDragPath.length >= 2) {
            const prevPos = this.#wireDragPath[this.#wireDragPath.length - 2];
            const prevKey = this.#getTileKey(prevPos, null);
            const prevTile = this.#wirePlacedTiles.get(prevKey);
            const prevConfig = wireConfigs[wireConfigs.length - 2];

            if (prevTile) {
                const wireEntity = prevTile.entity as Loophole_Wire & WithID;
                const needsUpdate =
                    wireEntity.rotation !== prevConfig.rotation ||
                    wireEntity.sprite !== prevConfig.sprite;

                if (needsUpdate) {
                    wireEntity.rotation = prevConfig.rotation;
                    wireEntity.sprite = prevConfig.sprite;
                    prevTile.entity = wireEntity;
                    prevTile.syncVisualState();
                    prevTile.setRotation(loopholeRotationToDegrees(prevConfig.rotation));
                }
            }
        }
    }

    #calculateWireConfigs(path: IVector<number>[]): Array<{
        rotation: Loophole_Rotation;
        sprite: 'STRAIGHT' | 'CORNER';
    }> {
        if (path.length === 0) return [];
        if (path.length === 1) {
            return [{ rotation: 'RIGHT', sprite: 'STRAIGHT' }];
        }

        return path.map((pos, i) => {
            const prev = i > 0 ? path[i - 1] : null;
            const next = i < path.length - 1 ? path[i + 1] : null;
            const incomingDir = prev ? this.#getDirection(prev, pos) : null;
            const outgoingDir = next ? this.#getDirection(pos, next) : null;

            if (!incomingDir || !outgoingDir) {
                const dir = incomingDir || outgoingDir;
                return {
                    rotation: dir || 'RIGHT',
                    sprite: 'STRAIGHT' as const,
                };
            }

            if (incomingDir === outgoingDir) {
                return {
                    rotation: incomingDir,
                    sprite: 'STRAIGHT' as const,
                };
            } else if (this.#areOppositeDirections(incomingDir, outgoingDir)) {
                return {
                    rotation: incomingDir,
                    sprite: 'STRAIGHT' as const,
                };
            } else {
                const rotation = this.#getCornerRotation(incomingDir, outgoingDir);
                return {
                    rotation,
                    sprite: 'CORNER' as const,
                };
            }
        });
    }

    #getDirection(from: IVector<number>, to: IVector<number>): Loophole_Rotation {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        if (dx > 0) return 'RIGHT';
        if (dx < 0) return 'LEFT';
        if (dy > 0) return 'DOWN';
        return 'UP';
    }

    #areOppositeDirections(dir1: Loophole_Rotation, dir2: Loophole_Rotation): boolean {
        return (
            (dir1 === 'RIGHT' && dir2 === 'LEFT') ||
            (dir1 === 'LEFT' && dir2 === 'RIGHT') ||
            (dir1 === 'UP' && dir2 === 'DOWN') ||
            (dir1 === 'DOWN' && dir2 === 'UP')
        );
    }

    #getCornerRotation(
        incomingDir: Loophole_Rotation,
        outgoingDir: Loophole_Rotation,
    ): Loophole_Rotation {
        const key = `${incomingDir}-${outgoingDir}`;
        return WIRE_TURNS[key] || 'RIGHT';
    }
}

class E_SelectionCursor extends Entity<LevelEditor> {
    #shapeComp: C_Shape;
    #opacityLerp: C_Lerp<number>;

    #selectAllClickPosition: Vector | null = null;
    #active: boolean = false;
    #wasActive: boolean = false;

    constructor(options: EntityOptions<LevelEditor>) {
        super({ name: 'ms_cursor', ...options });

        this.#shapeComp = this.addComponents(C_Shape<LevelEditor>, {
            name: 'rect',
            shape: 'RECT',
            style: { fillStyle: 'blue' },
            origin: 0,
        });
        this.#opacityLerp = this.addComponents(C_Lerp<number, LevelEditor>, {
            get: () => this.#shapeComp.style.globalAlpha ?? 0,
            set: (value: number) => {
                this.#shapeComp.style.globalAlpha = value;
            },
            speed: 5,
        });
    }

    get active(): boolean {
        return this.#active;
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);
        const pointerPosition = new Vector(this._engine.pointerState.worldPosition);

        const { brushEntityType, setSelectedTiles, isMovingTiles } = getAppStore();
        const leftButtonState = this._engine.getPointerButton(PointerButton.LEFT);
        if (leftButtonState.pressed && !isMovingTiles) {
            this.#selectAllClickPosition = new Vector(pointerPosition);
        } else if (leftButtonState.released || isMovingTiles) {
            this.#selectAllClickPosition = null;
        }

        if (
            (multiSelectIsActive(this._engine) || !brushEntityType) &&
            !cameraDragIsActive(this._engine) &&
            !isMovingTiles
        ) {
            if (leftButtonState.clicked) {
                setSelectedTiles([]);
            } else if (
                leftButtonState.down &&
                this.#selectAllClickPosition &&
                !pointerPosition.equals(this.#selectAllClickPosition)
            ) {
                let topLeft: IVector<number>, bottomRight: IVector<number>;
                if (
                    pointerPosition.x < this.#selectAllClickPosition.x ||
                    pointerPosition.y < this.#selectAllClickPosition.y
                ) {
                    topLeft = pointerPosition;
                    bottomRight = this.#selectAllClickPosition;
                } else {
                    topLeft = this.#selectAllClickPosition;
                    bottomRight = pointerPosition;
                }

                this.setPosition(topLeft).setScale({
                    x: bottomRight.x - topLeft.x,
                    y: bottomRight.y - topLeft.y,
                });

                const hoveredTiles = (
                    this._engine.pointerSystem
                        .getPointerTargetsWithinBox({
                            x1: Math.min(topLeft.x, bottomRight.x),
                            x2: Math.max(topLeft.x, bottomRight.x),
                            y1: Math.min(topLeft.y, bottomRight.y),
                            y2: Math.max(topLeft.y, bottomRight.y),
                        })
                        .map((t) => t.entity?.parent)
                        .filter((e) => e?.typeString === E_TileHighlight.name) as E_TileHighlight[]
                ).map((t) => t.tile);
                setSelectedTiles(hoveredTiles);

                updated = true;
                this.#active = true;
            } else {
                this.#active = false;
            }
        } else {
            this.#active = false;
        }

        this.#opacityLerp.target = this.#active ? 0.25 : 0;
        this._engine.pointerSystem.checkForOverlap = !this.#active;

        if (this.#active !== this.#wasActive) {
            if (this.#active) {
                this._engine.requestCursor('multi-select', 'crosshair', CURSOR_PRIORITY.BRUSH);
            }
            this.#wasActive = this.#active;
        }

        return updated;
    }
}

const HANDLE_ARROW_LENGTH = 3;
const BOX_COLOR_BOTH = '#DD5555';
const BOX_COLOR_X = '#55BB55';
const BOX_COLOR_Y = '#5555DD';

type DragAxis = 'x' | 'y' | 'both';

class E_DragCursor extends Entity<LevelEditor> {
    #upArrow: C_Shape;
    #rightArrow: C_Shape;
    #drawables: C_Drawable[];
    #opacityLerp: C_Lerp<number>;
    #positionLerp: C_LerpPosition<Vector>;

    #boxPointerTarget: C_PointerTarget;
    #upPointerTarget: C_PointerTarget;
    #rightPointerTarget: C_PointerTarget;

    #isDragging: boolean = false;
    #dragStartPosition: Vector | null = null;
    #originalEntities: Map<string, Loophole_EntityWithID> = new Map();
    #dragOffset: Loophole_Int2 = { x: 0, y: 0 };
    #dragAxis: DragAxis = 'both';

    #opacity = 0;

    constructor(options: EntityOptions<LevelEditor>) {
        super({ name: 'drag_handle', ...options });

        this.#upArrow = this.addComponents(C_Shape<LevelEditor>, {
            name: 'up-arrow',
            shape: 'LINE',
            start: { x: 0, y: -0.5 },
            end: { x: 0, y: -HANDLE_ARROW_LENGTH },
            style: { lineWidth: 0.15, strokeStyle: 'blue' },
            endTip: { type: 'arrow', length: 0.5 },
        });
        this.#rightArrow = this.addComponents(C_Shape<LevelEditor>, {
            name: 'right-arrow',
            shape: 'LINE',
            start: { x: 0.5, y: 0 },
            end: { x: HANDLE_ARROW_LENGTH, y: 0 },
            style: { lineWidth: 0.15, strokeStyle: 'green' },
            endTip: { type: 'arrow', length: 0.5 },
        });
        const shape = this.addComponents(C_Shape<LevelEditor>, {
            shape: 'RECT',
            style: { fillStyle: BOX_COLOR_BOTH, strokeStyle: 'red', lineWidth: 2 },
        });
        this.#drawables = [this.#upArrow, this.#rightArrow, shape];

        this.#boxPointerTarget = this.addComponents(C_PointerTarget<LevelEditor>, {
            cursorOnHover: 'move',
            cursorPriority: CURSOR_PRIORITY.HANDLE_HOVER,
        });

        this.#opacityLerp = this.addComponents(C_Lerp<number, LevelEditor>, {
            get: () => this.#opacity,
            set: (value: number) => {
                this.opacity = value;
            },
            speed: 10,
        });
        this.#positionLerp = this.addComponents(C_LerpPosition<Vector, LevelEditor>, {
            target: this,
            speed: 30,
        });
        this.opacity = 0;

        const upEntity = this.addEntities(Entity, {
            name: 'up',
            position: { x: 0, y: -(HANDLE_ARROW_LENGTH + 0.5) / 2 },
            scale: { x: 1, y: HANDLE_ARROW_LENGTH - 0.5 },
        });
        this.#upPointerTarget = upEntity.addComponents(C_PointerTarget<LevelEditor>, {
            cursorOnHover: 'ns-resize',
            cursorPriority: CURSOR_PRIORITY.HANDLE_HOVER,
        });

        const rightEntity = this.addEntities(Entity, {
            name: 'right',
            position: { x: (HANDLE_ARROW_LENGTH + 0.5) / 2, y: 0 },
            scale: { x: HANDLE_ARROW_LENGTH - 0.5, y: 1 },
        });
        this.#rightPointerTarget = rightEntity.addComponents(C_PointerTarget<LevelEditor>, {
            cursorOnHover: 'ew-resize',
            cursorPriority: CURSOR_PRIORITY.HANDLE_HOVER,
        });
    }

    set opacity(opacity: number) {
        this.#opacity = opacity;
        this.#drawables.forEach((d) => (d.style.globalAlpha = opacity));
    }

    override update(deltaTime: number): boolean {
        const updated = super.update(deltaTime);
        const { selectedTiles, setSelectedTiles, brushEntityType, setIsMovingTiles } =
            getAppStore();
        const selectedTileArray = Object.values(selectedTiles);
        const hasSelection = selectedTileArray.length > 0;

        const active = hasSelection && !brushEntityType;

        // Cursor management for drag handles
        let cursorType: CursorType | null = null;
        if (this.#isDragging) {
            cursorType =
                this.#dragAxis === 'x'
                    ? 'ew-resize'
                    : this.#dragAxis === 'y'
                      ? 'ns-resize'
                      : 'move';
        }
        if (cursorType) {
            this._engine.requestCursor('drag-handle', cursorType, CURSOR_PRIORITY.HANDLE_HOVER);
        }

        if (active) {
            const center = calculateSelectionCenter(selectedTileArray);
            this.#positionLerp.target = center;
            if (this.#opacityLerp.target === 0) {
                this.setPosition(this.#positionLerp.target);
            }

            if (
                this.#anyTargetHovered() &&
                this._engine.pointerState[PointerButton.LEFT].pressed &&
                !this.#isDragging
            ) {
                this.#dragAxis = this.#boxPointerTarget.isPointerHovered
                    ? 'both'
                    : this.#upPointerTarget.isPointerHovered
                      ? 'y'
                      : 'x';
                this.#isDragging = true;
                this.#dragStartPosition = new Vector(this._engine.pointerState.worldPosition);
                this.#dragOffset = { x: 0, y: 0 };
                this.#originalEntities.clear();
                selectedTileArray.forEach((tile) => {
                    this.#originalEntities.set(tile.entity.tID, { ...tile.entity });
                });
                setIsMovingTiles(true);
                this._engine.capturePointerButtonClick(PointerButton.LEFT);
            }

            if (this.#isDragging) {
                const currentPos = this._engine.pointerState.worldPosition;
                if (this.#dragStartPosition) {
                    const deltaX =
                        this.#dragAxis !== 'y' ? currentPos.x - this.#dragStartPosition.x : 0;
                    const deltaY =
                        this.#dragAxis !== 'x' ? this.#dragStartPosition.y - currentPos.y : 0;
                    const newOffsetX = Math.round(deltaX / TILE_SIZE);
                    const newOffsetY = Math.round(deltaY / TILE_SIZE);

                    if (newOffsetX !== this.#dragOffset.x || newOffsetY !== this.#dragOffset.y) {
                        this.#dragOffset = { x: newOffsetX, y: newOffsetY };
                        this.#updateTilePositions(selectedTileArray);
                    }
                }

                if (this._engine.pointerState[PointerButton.LEFT].released) {
                    this.#commitDrag();
                    this.#isDragging = false;
                    this.#dragStartPosition = null;
                    setIsMovingTiles(false);
                }

                if (this._engine.getKey('Escape').pressed) {
                    this.#cancelDrag(selectedTileArray);
                    this.#isDragging = false;
                    this.#dragStartPosition = null;
                    setIsMovingTiles(false);
                }
            }

            if (!this.#isDragging && selectedTileArray.length > 0) {
                if (this._engine.getKey('r').pressed) {
                    const center = calculateSelectionCenter(selectedTileArray);
                    const entities = selectedTileArray.map((t) => t.entity);
                    const newTiles = this._engine.rotateEntities(
                        entities,
                        {
                            x: center.x / TILE_SIZE,
                            y: -center.y / TILE_SIZE,
                        },
                        this._engine.getKey('Shift').down ? -90 : 90,
                    );
                    setSelectedTiles(newTiles);
                    newTiles.forEach((t) => t.syncVisualState());
                } else if (this._engine.getKey('x').pressed) {
                    const oneWayEntities = selectedTileArray
                        .map((t) => t.entity)
                        .filter((e) => e.entityType === 'ONE_WAY');
                    this._engine.updateEntities(
                        oneWayEntities,
                        oneWayEntities.map((e) => ({
                            flipDirection: !e.flipDirection,
                        })),
                    );
                }
            }
        }

        this.#opacityLerp.target = active
            ? this.#isDragging || this.#anyTargetHovered()
                ? 0.6
                : 1
            : 0;
        this.#boxPointerTarget.setEnabled(active);
        this.#upPointerTarget.setEnabled(active);
        this.#rightPointerTarget.setEnabled(active);

        if (
            selectedTileArray.length === 1 &&
            selectedTileArray[0].entity.entityType === 'EXPLOSION'
        ) {
            if (
                selectedTileArray[0].entity.direction === 'RIGHT' ||
                selectedTileArray[0].entity.direction === 'LEFT'
            ) {
                this.#upPointerTarget.entity?.setEnabled(false);
                this.#upArrow.setEnabled(false);
                this.#rightPointerTarget.entity?.setEnabled(true);
                this.#rightArrow.setEnabled(true);

                this.#drawables[2].style.fillStyle = BOX_COLOR_X;
                this.#drawables[2].style.strokeStyle = 'green';
            } else {
                this.#upPointerTarget.entity?.setEnabled(true);
                this.#upArrow.setEnabled(true);
                this.#rightPointerTarget.entity?.setEnabled(false);
                this.#rightArrow.setEnabled(false);

                this.#drawables[2].style.fillStyle = BOX_COLOR_Y;
                this.#drawables[2].style.strokeStyle = 'blue';
            }
        } else if (selectedTileArray.length > 0) {
            this.#upPointerTarget.entity?.setEnabled(true);
            this.#upArrow.setEnabled(true);
            this.#rightPointerTarget.entity?.setEnabled(true);
            this.#rightArrow.setEnabled(true);

            this.#drawables[2].style.fillStyle = BOX_COLOR_BOTH;
            this.#drawables[2].style.strokeStyle = 'red';
        }

        return updated;
    }

    #anyTargetHovered() {
        return (
            this.#boxPointerTarget.isPointerHovered ||
            this.#upPointerTarget.isPointerHovered ||
            this.#rightPointerTarget.isPointerHovered
        );
    }

    #updateTilePositions(tiles: E_Tile[]) {
        tiles.forEach((tile) => {
            const originalEntity = this.#originalEntities.get(tile.entity.tID);
            if (!originalEntity) return;

            const newEntity = { ...originalEntity };

            let newPosition: IVector<number>;
            if ('edgePosition' in newEntity) {
                newPosition = {
                    x: newEntity.edgePosition.cell.x + this.#dragOffset.x,
                    y: newEntity.edgePosition.cell.y + this.#dragOffset.y,
                };
                newEntity.edgePosition = {
                    ...newEntity.edgePosition,
                    cell: newPosition,
                };
            } else if ('position' in newEntity) {
                newPosition = {
                    x: newEntity.position.x + this.#dragOffset.x,
                    y: newEntity.position.y + this.#dragOffset.y,
                };
                newEntity.position = newPosition;
            } else if (newEntity.entityType === 'EXPLOSION') {
                newPosition = getLoopholeExplosionPosition(newEntity, this.#dragOffset);
                newEntity.startPosition = getLoopholeExplosionStartPosition(newEntity, newPosition);
            }

            tile.entity = newEntity;
        });
    }

    #commitDrag() {
        if (this.#dragOffset.x === 0 && this.#dragOffset.y === 0) {
            return;
        }

        const originalEntities = Array.from(this.#originalEntities.values());
        const newTiles = this._engine.moveEntities(originalEntities, this.#dragOffset);
        getAppStore().setSelectedTiles(newTiles);
        newTiles.forEach((t) => t.syncVisualState());

        this.#originalEntities.clear();
    }

    #cancelDrag(tiles: E_Tile[]) {
        tiles.forEach((tile) => {
            const originalEntity = this.#originalEntities.get(tile.entity.tID);
            if (originalEntity) {
                tile.entity = originalEntity;
            }
        });

        this.#originalEntities.clear();
        this.#dragOffset = { x: 0, y: 0 };
    }
}

export class UIScene extends Scene {
    #editor: LevelEditor | null = null;

    override create(editor: LevelEditor) {
        this.#editor = editor;
        this.add(E_SelectionCursor, { scale: 0 });
        this.add(E_TileCursor);
        this.add(E_DragCursor, { zIndex: 200, scale: 28, scaleToCamera: true });
    }

    override update(deltaTime: number): boolean {
        if (!this.#editor) return false;

        let updated = false;
        const { brushEntityType, setBrushEntityType, selectedTiles, setSelectedTiles } =
            getAppStore();

        if (this.#editor.getKey('Escape').pressed) {
            if (brushEntityType) {
                setBrushEntityType(null);
                updated = true;
            } else if (Object.keys(selectedTiles).length > 0) {
                setSelectedTiles([]);
                updated = true;
            }
        }

        if (!cameraDragIsActive(this.#editor)) {
            updated = this.#updateKeyboardControls(deltaTime) || updated;
        }

        return updated;
    }

    #updateKeyboardControls(deltaTime: number): boolean {
        if (!this.#editor) return false;

        const {
            brushEntityType,
            setBrushEntityType,
            selectedTiles,
            setSelectedTiles,
            centerCameraOnLevel,
        } = getAppStore();
        let updated = false;

        if (this.#editor.getKey('a').pressed && this.#editor.getKey('a').mod) {
            setSelectedTiles(
                Object.values(this.#editor.tiles).filter(
                    (t) => t.entity.entityType !== 'EXPLOSION',
                ),
            );
        }

        const cameraOffset = {
            x:
                (this.#editor.getKey('ArrowRight').downWithoutModAsNum ||
                    this.#editor.getKey('d').downWithoutModAsNum) -
                (this.#editor.getKey('ArrowLeft').downWithoutModAsNum ||
                    this.#editor.getKey('a').downWithoutModAsNum),
            y:
                (this.#editor.getKey('ArrowDown').downWithoutModAsNum ||
                    this.#editor.getKey('s').downWithoutModAsNum) -
                (this.#editor.getKey('ArrowUp').downWithoutModAsNum ||
                    this.#editor.getKey('w').downWithoutModAsNum),
        };
        if (cameraOffset.x !== 0 || cameraOffset.y !== 0) {
            const camera = this.#editor.camera;
            const offsetMagnitude = 500;
            this.#editor.setCameraPosition({
                x: camera.position.x - cameraOffset.x * offsetMagnitude * deltaTime,
                y: camera.position.y - cameraOffset.y * offsetMagnitude * deltaTime,
            });
            updated = true;
        }

        if (this.#editor.getKey('Backspace').pressed || this.#editor.getKey('Delete').pressed) {
            this.#editor.removeLoopholeEntities(Object.values(selectedTiles).map((t) => t.entity));
            updated = true;
        }

        const zKeyState = this.#editor.getKey('z');
        const yKeyState = this.#editor.getKey('y');
        if (zKeyState.pressed && zKeyState.mod) {
            this.#editor.undo();
            updated = true;
        } else if (yKeyState.pressed && yKeyState.mod) {
            this.#editor.redo();
            updated = true;
        }

        const keys = Object.keys(ENTITY_METADATA) as Loophole_ExtendedEntityType[];
        for (let i = 0; i < Object.keys(ENTITY_METADATA).length; i++) {
            if (this.#editor.getKey((i === 9 ? 0 : i + 1).toString() as WebKey).pressed) {
                const newBrushEntityType = brushEntityType === keys[i] ? null : keys[i];
                setBrushEntityType(newBrushEntityType);
                updated = true;
                break;
            }
        }

        if (this.#editor.getKey('f').pressed && this.#editor.getKey('f').mod) {
            centerCameraOnLevel();
        }

        return updated;
    }
}
