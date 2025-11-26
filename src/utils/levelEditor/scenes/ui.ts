import {
    calculateSelectionCenter,
    degreesToLoopholeRotation,
    ENTITY_METADATA,
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityPosition,
    getLoopholeExplosionPosition,
    getLoopholeExplosionStartPosition,
    loopholePositionToEnginePosition,
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
} from '../externalLevelSchema';
import { PointerButton } from '@/utils/engine/systems/pointer';
import { Vector, type IVector } from '@/utils/engine/math';
import type { LevelEditor } from '..';
import { C_Lerp, C_LerpPosition, C_LerpRotation } from '@/utils/engine/components/Lerp';
import { C_Shape } from '@/utils/engine/components/Shape';
import { E_Tile, E_TileHighlight } from './grid';
import { C_PointerTarget } from '@/utils/engine/components/PointerTarget';
import { v4 } from 'uuid';
import { E_EntityVisual } from '../entityVisual';
import type { C_Drawable } from '@/utils/engine/components';
import { C_Line } from '@/utils/engine/components/Line';

const multiSelectIsActive = (editor: LevelEditor) => editor.getKey('Shift').down;
const cameraDragIsActive = (editor: LevelEditor) =>
    editor.getPointerButton(PointerButton.RIGHT).down;

const CURSOR_PRIORITY = {
    DEFAULT: 0,
    TILE_HOVER: 5,
    BRUSH: 10,
    HANDLE_HOVER: 20,
    DRAGGING: 30,
    CAMERA_DRAG: 40,
} as const;

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

        // Cursor management for brush mode
        if (
            this._engine.pointerState.onScreen &&
            !multiSelectIsActive(this._engine) &&
            !cameraDragIsActive(this._engine) &&
            !isMovingTiles &&
            brushEntityType
        ) {
            // Show crosshair cursor in brush mode
            if (isDraggingToPlace) {
                this._engine.requestCursor(
                    'tile-cursor-dragging',
                    'grabbing',
                    CURSOR_PRIORITY.DRAGGING,
                );
            } else {
                this._engine.requestCursor('tile-cursor', 'crosshair', CURSOR_PRIORITY.BRUSH);
            }
        } else {
            this._engine.cancelCursorRequest('tile-cursor');
            this._engine.cancelCursorRequest('tile-cursor-dragging');
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
                    y: cursorPosition.y * TILE_SIZE,
                };
            else
                this.#targetPosition =
                    this.#dragEdgeAlignment === 'TOP'
                        ? {
                              x: tilePosition.x * TILE_SIZE,
                              y: (this.#dragStartTilePosition.y + 0.5) * TILE_SIZE,
                          }
                        : {
                              x: (this.#dragStartTilePosition.x + 0.5) * TILE_SIZE,
                              y: tilePosition.y * TILE_SIZE,
                          };

            let _brushEntityRotation = brushEntityRotation;
            let _brushEntityFlipDirection = brushEntityFlipDirection;
            if (this._engine.getKey('r').pressed) {
                if (hasRotation) {
                    _brushEntityRotation = degreesToLoopholeRotation(
                        loopholeRotationToDegrees(brushEntityRotation) + 90,
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

                // Place the first tile
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
            } else if (
                leftButton.down &&
                isDraggingToPlace &&
                this.#dragStartTilePosition &&
                !dragPlacementDisabled
            ) {
                // Continue dragging - place tiles along the line
                this.#handleDragPlacement(
                    tilePosition,
                    brushEntityType,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                );
            } else if (leftButton.released && isDraggingToPlace) {
                // End dragging
                setIsDraggingToPlace(false);
                this.#dragStartTilePosition = null;
                this.#placedTileDuringDrag.clear();
                this.#dragPositionType = null;
                this.#dragEdgeAlignment = null;
            } else if (leftButton.clicked && !isDraggingToPlace) {
                // Single click (short click with minimal movement)
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

            // Handle right click for removing tiles
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

        this.#positionLerp.target.set(this.#targetPosition || this.position);
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

        // Calculate the tiles to place based on positionType
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
            // EDGE types: drag along the axis that aligns with the edge
            // RIGHT edges (vertical) drag vertically, TOP edges (horizontal) drag horizontally
            if (this.#dragEdgeAlignment === 'RIGHT') {
                // RIGHT edges are vertical, so drag vertically
                const startY = Math.min(this.#dragStartTilePosition.y, currentTilePosition.y);
                const endY = Math.max(this.#dragStartTilePosition.y, currentTilePosition.y);
                const x = this.#dragStartTilePosition.x;
                for (let y = startY; y <= endY; y++) {
                    tilesToPlace.push({ x, y });
                }
            } else if (this.#dragEdgeAlignment === 'TOP') {
                // TOP edges are horizontal, so drag horizontally
                const startX = Math.min(this.#dragStartTilePosition.x, currentTilePosition.x);
                const endX = Math.max(this.#dragStartTilePosition.x, currentTilePosition.x);
                const y = this.#dragStartTilePosition.y;
                for (let x = startX; x <= endX; x++) {
                    tilesToPlace.push({ x, y });
                }
            }
        }

        // Place tiles that haven't been placed yet
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

        // Update selection if we placed any new tiles
        if (allPlacedTiles.length > 0) {
            const { selectedTiles, setSelectedTiles } = getAppStore();
            setSelectedTiles([...Object.values(selectedTiles), ...allPlacedTiles]);
        }
    }

    #getTileKey(position: IVector<number>, edgeAlignment: Loophole_EdgeAlignment | null): string {
        return `${position.x},${position.y},${edgeAlignment ?? 'NONE'}`;
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
                        .getPointerTargetsWithinBox(topLeft, bottomRight)
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

        // Cursor management for multi-select
        if (this.#active !== this.#wasActive) {
            if (this.#active) {
                this._engine.requestCursor('multi-select', 'crosshair', CURSOR_PRIORITY.BRUSH);
            } else {
                this._engine.cancelCursorRequest('multi-select');
            }
            this.#wasActive = this.#active;
        }

        return updated;
    }
}

const HANDLE_ARROW_LENGTH = 3;

type DragAxis = 'x' | 'y' | 'both';

class E_DragCursor extends Entity<LevelEditor> {
    #upArrow: C_Line;
    #rightArrow: C_Line;
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
    #wasHoveringHandle = false;

    constructor(options: EntityOptions<LevelEditor>) {
        super({ name: 'drag_handle', ...options });

        this.#upArrow = this.addComponents(C_Line<LevelEditor>, {
            name: 'up-arrow',
            start: { x: 0, y: -0.5 },
            end: { x: 0, y: -HANDLE_ARROW_LENGTH },
            style: { lineWidth: 0.15, fillStyle: 'blue' },
            endTip: { type: 'arrow', length: 0.5 },
        });
        this.#rightArrow = this.addComponents(C_Line<LevelEditor>, {
            name: 'right-arrow',
            start: { x: 0.5, y: 0 },
            end: { x: HANDLE_ARROW_LENGTH, y: 0 },
            style: { lineWidth: 0.15, fillStyle: 'green' },
            endTip: { type: 'arrow', length: 0.5 },
        });
        const shape = this.addComponents(C_Shape<LevelEditor>, {
            shape: 'RECT',
            style: { fillStyle: '#FF5555', strokeStyle: 'red', lineWidth: 2 },
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
        this.#upPointerTarget = upEntity.addComponents(C_PointerTarget<LevelEditor>, {});

        const rightEntity = this.addEntities(Entity, {
            name: 'right',
            position: { x: (HANDLE_ARROW_LENGTH + 0.5) / 2, y: 0 },
            scale: { x: HANDLE_ARROW_LENGTH - 0.5, y: 1 },
        });
        this.#rightPointerTarget = rightEntity.addComponents(C_PointerTarget<LevelEditor>, {});
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
        const isHoveringHandle = active && this.#anyTargetHovered();
        if (isHoveringHandle !== this.#wasHoveringHandle) {
            if (isHoveringHandle) {
                // Determine which handle is hovered and set appropriate cursor
                if (this.#boxPointerTarget.isPointerHovered) {
                    this._engine.requestCursor(
                        'drag-handle-box',
                        'move',
                        CURSOR_PRIORITY.HANDLE_HOVER,
                    );
                } else if (this.#upPointerTarget.isPointerHovered) {
                    this._engine.requestCursor(
                        'drag-handle-up',
                        'ns-resize',
                        CURSOR_PRIORITY.HANDLE_HOVER,
                    );
                } else if (this.#rightPointerTarget.isPointerHovered) {
                    this._engine.requestCursor(
                        'drag-handle-right',
                        'ew-resize',
                        CURSOR_PRIORITY.HANDLE_HOVER,
                    );
                }
            } else {
                this._engine.cancelCursorRequest('drag-handle-box');
                this._engine.cancelCursorRequest('drag-handle-up');
                this._engine.cancelCursorRequest('drag-handle-right');
            }
            this.#wasHoveringHandle = isHoveringHandle;
        }

        if (this.#isDragging) {
            this._engine.requestCursor('drag-dragging', 'grabbing', CURSOR_PRIORITY.DRAGGING);
        } else {
            this._engine.cancelCursorRequest('drag-dragging');
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
                        this.#dragAxis !== 'x' ? currentPos.y - this.#dragStartPosition.y : 0;
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
                    const center = this.#calculateSelectionCenterInt(selectedTileArray);
                    const entities = selectedTileArray.map((t) => t.entity);
                    const newTiles = this._engine.rotateEntities(
                        entities,
                        center,
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
            } else {
                this.#upPointerTarget.entity?.setEnabled(true);
                this.#upArrow.setEnabled(true);
                this.#rightPointerTarget.entity?.setEnabled(false);
                this.#rightArrow.setEnabled(false);
            }
        } else if (selectedTileArray.length > 0) {
            this.#upPointerTarget.entity?.setEnabled(true);
            this.#upArrow.setEnabled(true);
            this.#rightPointerTarget.entity?.setEnabled(true);
            this.#rightArrow.setEnabled(true);
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

    #calculateSelectionCenter(tiles: E_Tile[]): IVector<number> {
        if (tiles.length === 0) {
            return { x: 0, y: 0 };
        }

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        tiles.forEach((tile) => {
            const pos = getLoopholeEntityPosition(tile.entity);
            const edgeAlign = getLoopholeEntityEdgeAlignment(tile.entity);
            const enginePos = loopholePositionToEnginePosition(pos, edgeAlign);
            if (enginePos.x < minX) minX = enginePos.x;
            if (enginePos.y < minY) minY = enginePos.y;
            if (enginePos.x > maxX) maxX = enginePos.x;
            if (enginePos.y > maxY) maxY = enginePos.y;
        });

        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
        };
    }

    #calculateSelectionCenterInt(tiles: E_Tile[]): Loophole_Int2 {
        const center = this.#calculateSelectionCenter(tiles);
        return {
            x: Math.round(center.x),
            y: Math.round(center.y),
        };
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
    _engine: LevelEditor | null = null;

    override create(editor: LevelEditor) {
        this._engine = editor;

        this.add(E_SelectionCursor, { scale: 0 });
        this.add(E_TileCursor);
        this.add(E_DragCursor, { zIndex: 200, scale: 28, scaleToCamera: true });
    }

    override update(deltaTime: number): boolean {
        if (!this._engine) return false;

        let updated = false;
        const { brushEntityType, setBrushEntityType, selectedTiles, setSelectedTiles } =
            getAppStore();

        if (this._engine.getKey('Escape').pressed) {
            if (brushEntityType) {
                setBrushEntityType(null);
                updated = true;
            } else if (Object.keys(selectedTiles).length > 0) {
                setSelectedTiles([]);
                updated = true;
            }
        }

        if (!cameraDragIsActive(this._engine)) {
            updated = this.#updateKeyboardControls(deltaTime) || updated;
        }

        return updated;
    }

    #updateKeyboardControls(deltaTime: number): boolean {
        if (!this._engine) return false;

        const { brushEntityType, setBrushEntityType, selectedTiles, setSelectedTiles } =
            getAppStore();
        let updated = false;

        if (this._engine.getKey('a').pressed && this._engine.getKey('a').mod) {
            setSelectedTiles(Object.values(this._engine.tiles));
        }

        const cameraOffset = {
            x:
                (this._engine.getKey('ArrowRight').downWithoutModAsNum ||
                    this._engine.getKey('d').downWithoutModAsNum) -
                (this._engine.getKey('ArrowLeft').downWithoutModAsNum ||
                    this._engine.getKey('a').downWithoutModAsNum),
            y:
                (this._engine.getKey('ArrowDown').downWithoutModAsNum ||
                    this._engine.getKey('s').downWithoutModAsNum) -
                (this._engine.getKey('ArrowUp').downWithoutModAsNum ||
                    this._engine.getKey('w').downWithoutModAsNum),
        };
        if (cameraOffset.x !== 0 || cameraOffset.y !== 0) {
            const camera = this._engine.camera;
            const offsetMagnitude = 500;
            this._engine.setCameraPosition({
                x: camera.position.x - cameraOffset.x * offsetMagnitude * deltaTime,
                y: camera.position.y - cameraOffset.y * offsetMagnitude * deltaTime,
            });
            updated = true;
        }

        if (this._engine.getKey('Backspace').pressed || this._engine.getKey('Delete').pressed) {
            this._engine.removeEntities(Object.values(selectedTiles).map((t) => t.entity));
            updated = true;
        }

        const zKeyState = this._engine.getKey('z');
        const yKeyState = this._engine.getKey('y');
        if (zKeyState.pressed && zKeyState.mod) {
            this._engine.undo();
            updated = true;
        } else if (yKeyState.pressed && yKeyState.mod) {
            this._engine.redo();
            updated = true;
        }

        const keys = Object.keys(ENTITY_METADATA) as Loophole_ExtendedEntityType[];
        for (let i = 0; i < Object.keys(ENTITY_METADATA).length; i++) {
            if (this._engine.getKey((i === 9 ? 0 : i + 1).toString()).pressed) {
                const newBrushEntityType = brushEntityType === keys[i] ? null : keys[i];
                setBrushEntityType(newBrushEntityType);
                updated = true;
                break;
            }
        }

        return updated;
    }
}
