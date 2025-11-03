import {
    degreesToLoopholeRotation,
    ENTITY_METADATA,
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityPosition,
    loopholePositionToEnginePosition,
    loopholeRotationToDegrees,
    TILE_SIZE,
} from '@/utils/utils';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import { C_Image } from '@/utils/engine/components/Image';
import { getAppStore } from '@/utils/store';
import {
    MAX_ENTITY_COUNT,
    type Loophole_EdgeAlignment,
    type Loophole_EntityWithID,
    type Loophole_ExtendedEntityType,
    type Loophole_Int2,
    type Loophole_Rotation,
} from '../externalLevelSchema';
import { PointerButton } from '@/utils/engine/systems/pointer';
import type { Position } from '@/utils/engine/types';
import type { LevelEditor } from '..';
import {
    C_Lerp,
    C_LerpOpacity,
    C_LerpPosition,
    C_LerpRotation,
} from '@/utils/engine/components/Lerp';
import { positionsEqual } from '@/utils/engine/utils';
import { C_Shape } from '@/utils/engine/components/Shape';
import { E_Tile } from './grid';
import { C_PointerTarget } from '@/utils/engine/components/PointerTarget';
import { v4 } from 'uuid';

const HANDLE_COLOR = 'yellow';
const HANDLE_HOVER_COLOR = 'red';

const multiSelectIsActive = (editor: LevelEditor) => editor.getKey('Shift').down;
const cameraDragIsActive = (editor: LevelEditor) =>
    editor.getPointerButton(PointerButton.RIGHT).down;

class E_TileCursor extends Entity {
    #editor: LevelEditor;
    #tileImage: C_Image;

    #positionLerp: C_Lerp<Position>;
    #tileOpacityLerp: C_Lerp<number>;
    #tileRotationLerp: C_Lerp<number>;

    #targetPosition: Position | null = null;
    #targetRotation: number | null = null;
    #active: boolean = false;

    #dragStartTilePosition: Position | null = null;
    #placedTileDuringDrag: Set<string> = new Set();
    #dragPositionType: 'CELL' | 'EDGE' | null = null;
    #dragEdgeAlignment: Loophole_EdgeAlignment | null = null;
    #dragHash: string | null = null;

    constructor(editor: LevelEditor) {
        const tileImageComp = new C_Image('cursor', ENTITY_METADATA['MUSHROOM_BLUE'].name, {
            imageSmoothingEnabled: false,
            globalAlpha: 0,
        });

        super('cursor', tileImageComp);

        this.#editor = editor;
        this.setZIndex(50);
        this.#tileImage = tileImageComp;
        this.#tileOpacityLerp = new C_LerpOpacity(this.#tileImage, 4);
        this.#positionLerp = new C_LerpPosition(this, 20);
        this.#tileRotationLerp = new C_LerpRotation(this, 1000);
        this.addComponents(this.#tileOpacityLerp, this.#positionLerp, this.#tileRotationLerp);
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
            this.#editor.pointerState.onScreen &&
            !multiSelectIsActive(this.#editor) &&
            !cameraDragIsActive(this.#editor) &&
            !isMovingTiles &&
            brushEntityType
        ) {
            const {
                positionType,
                name,
                tileScale: tileScaleOverride,
                hasRotation,
                hasFlipDirection,
                type,
            } = ENTITY_METADATA[brushEntityType];
            this.#tileImage.imageName = name;

            const { position: tilePosition, edgeAlignment } =
                this.#editor.calculateTilePositionFromWorld(
                    this.#editor.pointerState.worldPosition,
                    brushEntityType,
                );
            const cursorPosition = tilePosition;
            if (positionType === 'CELL') {
                this.#targetRotation = 0;
            } else {
                const cellX = Math.round(this.#editor.pointerState.worldPosition.x / TILE_SIZE);
                const cellY = Math.round(this.#editor.pointerState.worldPosition.y / TILE_SIZE);
                const localX = this.#editor.pointerState.worldPosition.x - cellX * TILE_SIZE;
                const localY = this.#editor.pointerState.worldPosition.y - cellY * TILE_SIZE;

                if (Math.abs(localX) > Math.abs(localY)) {
                    this.#targetRotation = loopholeRotationToDegrees('RIGHT');
                } else {
                    this.#targetRotation = loopholeRotationToDegrees('UP');
                }
            }

            this.#targetPosition = {
                x: cursorPosition.x * TILE_SIZE,
                y: cursorPosition.y * TILE_SIZE,
            };

            let _brushEntityRotation = brushEntityRotation;
            let _brushEntityFlipDirection = brushEntityFlipDirection;
            if (this.#editor.getKey('r').pressed) {
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

            const leftButton = this.#editor.getPointerButton(PointerButton.LEFT);
            const rightButton = this.#editor.getPointerButton(PointerButton.RIGHT);

            if (leftButton.pressed && !isDraggingToPlace) {
                setIsDraggingToPlace(true);
                this.#dragStartTilePosition = { ...tilePosition };
                this.#placedTileDuringDrag.clear();
                this.#dragPositionType = positionType;
                this.#dragEdgeAlignment = edgeAlignment;
                this.#dragHash = v4();

                // Place the first tile
                const tiles = this.#editor.placeTile(
                    tilePosition,
                    brushEntityType,
                    edgeAlignment,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                    this.#dragHash,
                );
                setSelectedTiles(tiles);
                this.#placedTileDuringDrag.add(this.#getTileKey(tilePosition, edgeAlignment));
            } else if (leftButton.down && isDraggingToPlace && this.#dragStartTilePosition) {
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
                const tiles = this.#editor.placeTile(
                    tilePosition,
                    brushEntityType,
                    edgeAlignment,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                );
                setSelectedTiles(tiles);
                this.#editor.capturePointerButtonClick(PointerButton.LEFT);
            }

            // Handle right click for removing tiles
            if (rightButton.clicked) {
                this.#editor.removeTiles([
                    {
                        position: tilePosition,
                        positionType,
                        entityType: type,
                        edgeAlignment,
                    },
                ]);
                this.#editor.capturePointerButtonClick(PointerButton.RIGHT);
            }

            this.#active = true;
        } else {
            this.#targetPosition = null;
            this.#active = false;
        }

        this.#positionLerp.target = this.#targetPosition ?? this.position;
        this.#tileOpacityLerp.target =
            this.#active && this.#editor.entityCount < MAX_ENTITY_COUNT ? 0.5 : 0;
        if (!isDraggingToPlace) {
            this.#tileRotationLerp.target = this.#targetRotation ?? this.rotation;
        }

        return updated;
    }

    #handleDragPlacement(
        currentTilePosition: Position,
        brushEntityType: Loophole_ExtendedEntityType,
        brushEntityRotation: Loophole_Rotation,
        brushEntityFlipDirection: boolean,
    ) {
        if (!this.#dragStartTilePosition || !this.#dragPositionType) return;

        // Calculate the tiles to place based on positionType
        const tilesToPlace: Position[] = [];

        if (this.#dragPositionType === 'CELL') {
            // CELL types: fill a rectangle (no directional constraint)
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
        const edgeAlignment = this.#dragEdgeAlignment ?? 'RIGHT';

        for (const pos of tilesToPlace) {
            const key = this.#getTileKey(pos, edgeAlignment);
            if (!this.#placedTileDuringDrag.has(key)) {
                const tiles = this.#editor.placeTile(
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

    #getTileKey(position: Position, edgeAlignment: Loophole_EdgeAlignment | null): string {
        return `${position.x},${position.y},${edgeAlignment ?? 'NONE'}`;
    }
}

class E_SelectionCursor extends Entity {
    #editor: LevelEditor;
    #shapeComp: C_Shape;
    #opacityLerp: C_Lerp<number>;

    #selectAllClickPosition: Position | null = null;
    #active: boolean = false;

    constructor(editor: LevelEditor) {
        super('ms_cursor');

        this.#editor = editor;
        this.#shapeComp = new C_Shape('rect', 'RECT', {
            fillStyle: 'blue',
        }).setOrigin(0);
        this.#opacityLerp = new C_Lerp<number>({
            get: (() => this.#shapeComp.style.globalAlpha ?? 0).bind(this),
            set: ((value: number) => {
                this.#shapeComp.style.globalAlpha = value;
            }).bind(this),
            speed: 5,
        });

        this.addComponents(this.#shapeComp, this.#opacityLerp).setScale(0);
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);
        const pointerPosition = { ...this.#editor.pointerState.worldPosition };

        const { brushEntityType, setSelectedTiles, isMovingTiles } = getAppStore();
        const leftButtonState = this.#editor.getPointerButton(PointerButton.LEFT);
        if (leftButtonState.pressed && !isMovingTiles) {
            this.#selectAllClickPosition = pointerPosition;
        } else if (leftButtonState.released || isMovingTiles) {
            this.#selectAllClickPosition = null;
        }

        if (
            (multiSelectIsActive(this.#editor) || !brushEntityType) &&
            !cameraDragIsActive(this.#editor) &&
            !isMovingTiles
        ) {
            if (leftButtonState.clicked) {
                setSelectedTiles([]);
            } else if (
                leftButtonState.down &&
                this.#selectAllClickPosition &&
                !positionsEqual(pointerPosition, this.#selectAllClickPosition)
            ) {
                let topLeft: Position, bottomRight: Position;
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

                const hoveredTiles = this.#editor.pointerSystem
                    .getPointerTargetsWithinBox(topLeft, bottomRight)
                    .map((t) => t.entity?.parent)
                    .filter((e) => e?.typeString === E_Tile.name) as E_Tile[];
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

        return updated;
    }
}

class E_DragCursor extends Entity {
    #editor: LevelEditor;
    #handleShape: C_Shape;
    #pointerTarget: C_PointerTarget;
    #opacityLerp: C_Lerp<number>;
    #positionLerp: C_LerpPosition;

    #isDragging: boolean = false;
    #dragStartPosition: Position | null = null;
    #originalEntities: Map<string, Loophole_EntityWithID> = new Map();
    #dragOffset: Loophole_Int2 = { x: 0, y: 0 };

    constructor(editor: LevelEditor) {
        super('drag_handle');

        this.#editor = editor;
        this.#handleShape = new C_Shape('handle', 'ELLIPSE', {
            fillStyle: HANDLE_COLOR,
            globalAlpha: 0,
        });
        this.#pointerTarget = new C_PointerTarget();
        this.#opacityLerp = new C_Lerp({
            get: (() => this.#handleShape.style.globalAlpha ?? 0).bind(this),
            set: ((value: number) => {
                this.#handleShape.style.globalAlpha = value;
            }).bind(this),
            speed: 10,
        });
        this.#positionLerp = new C_LerpPosition(this, 20);

        this.addComponents(
            this.#handleShape,
            this.#pointerTarget,
            this.#opacityLerp,
            this.#positionLerp,
        )
            .setZIndex(200)
            .setScale(20)
            .setScaleToCamera(true);
    }

    override update(deltaTime: number): boolean {
        const updated = super.update(deltaTime);
        const { selectedTiles, setSelectedTiles, brushEntityType, setIsMovingTiles } =
            getAppStore();
        const selectedTileArray = Object.values(selectedTiles);
        const hasSelection = selectedTileArray.length > 0;

        const active = hasSelection && !brushEntityType;
        if (active) {
            const center = this.#calculateSelectionCenter(selectedTileArray);
            this.#positionLerp.target = {
                x: center.x * TILE_SIZE,
                y: center.y * TILE_SIZE,
            };
            if (this.#opacityLerp.target === 0) {
                this.setPosition(this.#positionLerp.target);
            }

            if (
                this.#pointerTarget.isPointerHovered &&
                this.#editor.pointerState[PointerButton.LEFT].pressed &&
                !this.#isDragging
            ) {
                this.#isDragging = true;
                this.#dragStartPosition = { ...this.#editor.pointerState.worldPosition };
                this.#dragOffset = { x: 0, y: 0 };
                this.#originalEntities.clear();
                selectedTileArray.forEach((tile) => {
                    this.#originalEntities.set(tile.entity.tID, { ...tile.entity });
                });
                setIsMovingTiles(true);
                this.#editor.capturePointerButtonClick(PointerButton.LEFT);
            }

            if (this.#isDragging) {
                const currentPos = this.#editor.pointerState.worldPosition;
                if (this.#dragStartPosition) {
                    const deltaX = currentPos.x - this.#dragStartPosition.x;
                    const deltaY = currentPos.y - this.#dragStartPosition.y;
                    const newOffsetX = Math.round(deltaX / TILE_SIZE);
                    const newOffsetY = Math.round(deltaY / TILE_SIZE);

                    if (newOffsetX !== this.#dragOffset.x || newOffsetY !== this.#dragOffset.y) {
                        this.#dragOffset = { x: newOffsetX, y: newOffsetY };
                        this.#updateTilePositions(selectedTileArray);
                    }
                }

                if (this.#editor.pointerState[PointerButton.LEFT].released) {
                    this.#commitDrag();
                    this.#isDragging = false;
                    this.#dragStartPosition = null;
                    setIsMovingTiles(false);
                }

                if (this.#editor.getKey('Escape').pressed) {
                    this.#cancelDrag(selectedTileArray);
                    this.#isDragging = false;
                    this.#dragStartPosition = null;
                    setIsMovingTiles(false);
                }
            }

            if (
                this.#editor.getKey('r').pressed &&
                !this.#isDragging &&
                selectedTileArray.length > 0
            ) {
                const center = this.#calculateSelectionCenterInt(selectedTileArray);
                const entities = selectedTileArray.map((t) => t.entity);
                const newTiles = this.#editor.rotateEntities(
                    entities,
                    center,
                    this.#editor.getKey('Shift').down ? -90 : 90,
                );
                setSelectedTiles(newTiles);
                newTiles.forEach((t) => t.syncVisualState());
            }
        }

        this.#opacityLerp.target = active ? 0.8 : 0;
        this.#pointerTarget.setEnabled(active);
        this.#handleShape.style.fillStyle =
            this.#pointerTarget.isPointerHovered || this.#isDragging
                ? HANDLE_HOVER_COLOR
                : HANDLE_COLOR;

        return updated;
    }

    #calculateSelectionCenter(tiles: E_Tile[]): Position {
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

            let newPosition: Position;
            if ('edgePosition' in newEntity) {
                newPosition = {
                    x: newEntity.edgePosition.cell.x + this.#dragOffset.x,
                    y: newEntity.edgePosition.cell.y + this.#dragOffset.y,
                };
                newEntity.edgePosition = {
                    ...newEntity.edgePosition,
                    cell: newPosition,
                };
            } else {
                newPosition = {
                    x: newEntity.position.x + this.#dragOffset.x,
                    y: newEntity.position.y + this.#dragOffset.y,
                };
                newEntity.position = newPosition;
            }

            tile.entity = newEntity;
        });
    }

    #commitDrag() {
        if (this.#dragOffset.x === 0 && this.#dragOffset.y === 0) {
            return;
        }

        const originalEntities = Array.from(this.#originalEntities.values());
        const newTiles = this.#editor.moveEntities(originalEntities, this.#dragOffset);

        getAppStore().setSelectedTiles(newTiles);
        newTiles.forEach((t) => t.syncVisualState());
        this.#originalEntities.clear();
    }

    #cancelDrag(tiles: E_Tile[]) {
        // Restore original positions
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

        this.addEntities(
            new E_SelectionCursor(editor),
            new E_TileCursor(editor),
            new E_DragCursor(editor),
        );
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

        const { brushEntityType, setBrushEntityType, selectedTiles, setSelectedTiles } =
            getAppStore();
        let updated = false;

        if (this.#editor.getKey('a').pressed && this.#editor.getKey('a').mod) {
            setSelectedTiles(Object.values(this.#editor.tiles));
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
            const offsetMagnitude = 500 * this.#editor.camera.zoom;
            this.#editor.setCameraPosition({
                x: camera.position.x - cameraOffset.x * offsetMagnitude * deltaTime,
                y: camera.position.y - cameraOffset.y * offsetMagnitude * deltaTime,
            });
            updated = true;
        }

        if (this.#editor.getKey('Backspace').pressed || this.#editor.getKey('Delete').pressed) {
            this.#editor.removeEntities(Object.values(selectedTiles).map((t) => t.entity));
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
            if (this.#editor.getKey((i === 9 ? 0 : i + 1).toString()).pressed) {
                const newBrushEntityType = brushEntityType === keys[i] ? null : keys[i];
                setBrushEntityType(newBrushEntityType);
                updated = true;
                break;
            }
        }

        return updated;
    }
}
