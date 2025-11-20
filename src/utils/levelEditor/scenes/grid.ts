import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import type { Loophole_EntityWithID, Loophole_ExtendedEntityType } from '../externalLevelSchema';
import { C_PointerTarget } from '../../engine/components/PointerTarget';
import { getAppStore, getSettingsStore } from '@/utils/stores';
import { C_Image } from '@/utils/engine/components/Image';
import type { LevelEditor } from '..';
import { PointerButton } from '@/utils/engine/systems/pointer';
import { zoomToScale } from '../../engine/utils';
import {
    ENTITY_METADATA,
    ENTITY_TYPE_DRAW_ORDER,
    getLoopholeEntityDegreeRotation,
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityExtendedType,
    getLoopholeEntityPosition,
    getLoopholeEntityPositionType,
    loopholePositionToEnginePosition,
    TILE_SIZE,
} from '@/utils/utils';
import { C_Lerp, C_LerpOpacity, C_LerpPosition } from '@/utils/engine/components/Lerp';
import type { Position } from '@/utils/engine/types';
import { E_InfiniteShape } from './InfiniteShape';
import { E_EntityVisual } from '../entityVisual';

const ACTIVE_TILE_OPACITY = 0.3;

type TileVariant = 'default' | 'entrance' | 'exit' | 'explosion';

export class E_TileHighlight extends Entity {
    #tile: E_Tile;

    constructor(tile: E_Tile) {
        super({ name: 'tile_highlight' });

        this.#tile = tile;
    }

    get tile(): E_Tile {
        return this.#tile;
    }
}

export class E_Tile extends Entity {
    #editor: LevelEditor;
    #entity: Loophole_EntityWithID;
    #type: Loophole_ExtendedEntityType;
    #variant: TileVariant = 'default';

    #initialized: boolean = false;
    #canBeReused: boolean = true;

    #tileImage: C_Image;
    #positionLerp: C_Lerp<Position>;

    #entityVisual: E_EntityVisual;

    #highlightEntity: E_TileHighlight;
    #pointerParent: Entity;
    #pointerTarget: C_PointerTarget;
    #highlightShape: C_Shape;
    #opacityLerp: C_Lerp<number>;

    constructor(editor: LevelEditor, entity: Loophole_EntityWithID) {
        super('tile');

        this.#editor = editor;
        this.#entity = entity;
        this.#type = getLoopholeEntityExtendedType(entity);
        this.#tileImage = new C_Image({
            name: 'tile-image',
            imageName: '',
            style: {
                imageSmoothingEnabled: false,
            },
        }).setZIndex(10);
        this.#positionLerp = new C_LerpPosition(this, 20);
        this.addComponents(this.#tileImage, this.#positionLerp);

        this.#highlightEntity = new E_TileHighlight(this).setZIndex(-1);
        this.#entityVisual = new E_EntityVisual({ mode: 'tile' }).setZIndex(-1);
        this.#pointerParent = new Entity('pointer_parent');
        this.#highlightEntity.addEntities(this.#entityVisual, this.#pointerParent);

        this.#pointerTarget = new C_PointerTarget();
        this.#pointerTarget.canInteract = false;
        this.#highlightShape = new C_Shape({
            name: 'shape',
            shape: 'RECT',
            style: {
                fillStyle: 'white',
                globalAlpha: 0,
            },
            zIndex: 1,
        });
        this.#opacityLerp = new C_LerpOpacity(this.#highlightShape, 5);
        this.#pointerParent.addComponents(
            this.#pointerTarget,
            this.#highlightShape,
            this.#opacityLerp,
        );

        if (this.entity.entityType === 'EXPLOSION') {
            this.#editor.addSceneEntities(GridScene.name, this.#highlightEntity);
            this.#canBeReused = false;
        } else {
            this.addEntities(this.#highlightEntity);
        }
    }

    get entity(): Loophole_EntityWithID {
        return this.#entity;
    }

    set entity(entity: Loophole_EntityWithID) {
        this.#entity = entity;
        this.#type = getLoopholeEntityExtendedType(entity);
        this.#onEntityChanged();
    }

    get type(): Loophole_ExtendedEntityType {
        return this.#type;
    }

    get variant(): TileVariant {
        return this.#variant;
    }

    set variant(variant: TileVariant) {
        this.#variant = variant;
    }

    get initialized(): boolean {
        return this.#initialized;
    }

    set initialized(initialized: boolean) {
        this.#initialized = initialized;
    }

    get canBeReused(): boolean {
        return this.#canBeReused;
    }

    get tileImage(): C_Image {
        return this.#tileImage;
    }

    get highlightEntity(): Entity {
        return this.#highlightEntity;
    }

    override update(deltaTime: number) {
        const { brushEntityType, selectedTiles, setSelectedTiles, lockedLayers } = getAppStore();
        this.#pointerTarget.canInteract = Boolean(!lockedLayers[this.#type]);
        const hoveredByPointer = this.#pointerTarget.isPointerHovered && brushEntityType === null;
        const active = hoveredByPointer || selectedTiles[this.entity.tID] !== undefined;

        if (hoveredByPointer && this.#editor.pointerState[PointerButton.LEFT].clicked) {
            if (this.#editor.getKey('Meta').down || this.#editor.getKey('Control').down) {
                const newSelectedTiles = { ...selectedTiles };
                if (this.entity.tID in newSelectedTiles) {
                    delete newSelectedTiles[this.entity.tID];
                } else {
                    newSelectedTiles[this.entity.tID] = this;
                }
                setSelectedTiles(Object.values(newSelectedTiles));
            } else {
                setSelectedTiles([this]);
            }

            this.#editor.capturePointerButtonClick(PointerButton.LEFT);
        }

        this.#opacityLerp.target = active ? ACTIVE_TILE_OPACITY : 0;

        this.#updatePosition();

        return super.update(deltaTime);
    }

    override destroy(): void {
        this.#highlightEntity.destroy();
        super.destroy();
    }

    syncVisualState() {
        const { selectedTiles } = getAppStore();
        this.#highlightShape.style.globalAlpha =
            this.entity.tID in selectedTiles ? ACTIVE_TILE_OPACITY : 0;
    }

    stashTile() {
        if (!this.#canBeReused) {
            return;
        }

        this.initialized = false;
        this.setEnabled(false);
        this.#highlightEntity.setEnabled(false); // TODO: make disabling propagate to children
    }

    #onEntityChanged() {
        const loopholePosition = getLoopholeEntityPosition(this.#entity);
        const edgeAlignment = getLoopholeEntityEdgeAlignment(this.#entity);
        const positionType = getLoopholeEntityPositionType(this.#entity);
        const enginePosition = loopholePositionToEnginePosition(loopholePosition, edgeAlignment);
        this.#type = getLoopholeEntityExtendedType(this.#entity);
        const { tileScale: tileScaleOverride = 1, highlightScale = 1 } =
            ENTITY_METADATA[this.#type];

        this.setScale(tileScaleOverride * TILE_SIZE);
        this.setRotation(getLoopholeEntityDegreeRotation(this.#entity));

        const newPosition = {
            x: enginePosition.x * TILE_SIZE,
            y: enginePosition.y * TILE_SIZE,
        };
        this.#positionLerp.target = newPosition;
        if (!this.#initialized) {
            this.setPosition(newPosition);
            this.#initialized = true;
        }

        const pointerScale =
            positionType === 'CELL'
                ? highlightScale
                : { x: highlightScale * 0.5, y: highlightScale };

        this.#pointerParent.setScale(pointerScale);

        this.setZIndex(ENTITY_TYPE_DRAW_ORDER[this.#entity.entityType] + 1);

        this.#updatePosition();

        this.#highlightEntity.setEnabled(true);
        this.#entityVisual.onEntityChanged(this.#type, this.#entity);
    }

    #updatePosition() {
        if (this.#entity.entityType === 'EXPLOSION' && this.#editor.canvasSize) {
            const isHorizontal =
                this.#entity.direction === 'RIGHT' || this.#entity.direction === 'LEFT';
            const scale = zoomToScale(this.#editor.camera.zoom);
            const length =
                (isHorizontal ? this.#editor.canvasSize.y : this.#editor.canvasSize.x) / scale;
            this.#highlightEntity
                .setScale(isHorizontal ? { x: TILE_SIZE, y: length } : { x: length, y: TILE_SIZE })
                .setPosition(
                    isHorizontal
                        ? {
                              x: this.position.x,
                              y: -this.#editor.camera.position.y / scale,
                          }
                        : {
                              x: -this.#editor.camera.position.x / scale,
                              y: this.position.y,
                          },
                );
        }
    }
}

const DOT_SIZE = 8;
const DOT_GAP = TILE_SIZE / DOT_SIZE;

const SCREEN_BORDER_SIZE = {
    x: 35 * TILE_SIZE,
    y: 19 * TILE_SIZE,
};

export class GridScene extends Scene {
    #grids: Entity[] = [];

    override create() {
        this.#grids.push(
            new E_InfiniteShape({
                name: 'grid',
                shape: new C_Shape({
                    name: 'dots',
                    shape: 'ELLIPSE',
                    style: { fillStyle: 'white', globalAlpha: 0.5 },
                    gap: DOT_GAP,
                }),
                tileSize: TILE_SIZE,
                zoomCullThresh: 0.2,
                scale: DOT_SIZE,
            }),
            new E_InfiniteShape({
                name: 'border',
                shape: new C_Shape({
                    name: 'border',
                    shape: 'RECT',
                    style: {
                        fillStyle: '',
                        strokeStyle: 'white',
                        lineWidth: 4,
                        globalAlpha: 0.5,
                    },
                }),
                tileSize: SCREEN_BORDER_SIZE,
                offset: {
                    x: SCREEN_BORDER_SIZE.x / 2,
                    y: SCREEN_BORDER_SIZE.y / 2,
                },
                scale: SCREEN_BORDER_SIZE,
            }),
        );
        this.addEntities(...this.#grids);
    }

    override update() {
        let updated = false;

        const { showGrid } = getSettingsStore();
        this.#grids.forEach((grid) => {
            if (grid.enabled !== showGrid) {
                updated = true;
                grid.setEnabled(showGrid);
            }
        });

        return updated;
    }
}
