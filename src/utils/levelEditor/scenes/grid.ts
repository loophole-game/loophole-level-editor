import { C_Shape } from '../../engine/components/Shape';
import { Entity, type EntityOptions } from '../../engine/entities';
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
import {
    C_Lerp,
    C_LerpOpacity,
    C_LerpPosition,
    C_LerpRotation,
} from '@/utils/engine/components/Lerp';
import { E_InfiniteShape } from './InfiniteShape';
import { E_EntityVisual } from '../entityVisual';
import type { Vector } from '@/utils/engine/math';

const ACTIVE_TILE_OPACITY = 0.3;

type TileVariant = 'default' | 'entrance' | 'exit' | 'explosion';

interface E_TileHighlightOptions extends EntityOptions {
    tile: E_Tile;
}

export class E_TileHighlight extends Entity<LevelEditor> {
    #tile: E_Tile;

    constructor(options: E_TileHighlightOptions) {
        super({ name: 'tile_highlight', ...options });

        this.#tile = options.tile;
    }

    get tile(): E_Tile {
        return this.#tile;
    }
}

interface E_TileOptions extends EntityOptions {
    entity: Loophole_EntityWithID;
}

export class E_Tile extends Entity {
    #entity: Loophole_EntityWithID;
    #type: Loophole_ExtendedEntityType;
    #variant: TileVariant = 'default';

    #initialized: boolean = false;
    #canBeReused: boolean = true;

    #tileImage: C_Image;
    #positionLerp: C_Lerp<Vector>;
    #rotationLerp: C_Lerp<number>;

    #entityVisual: E_EntityVisual;

    #highlightEntity: E_TileHighlight;
    #pointerParent: Entity;
    #pointerTarget: C_PointerTarget;
    #highlightShape: C_Shape;
    #opacityLerp: C_Lerp<number>;

    constructor(options: E_TileOptions) {
        super({ name: 'tile', ...options });

        this.#entity = options.entity;
        this.#type = getLoopholeEntityExtendedType(options.entity);
        this.#tileImage = this.addComponents(C_Image, {
            name: 'tile-image',
            imageName: '',
            style: {
                imageSmoothingEnabled: false,
            },
            zIndex: 10,
        });
        this.#positionLerp = this.addComponents(C_LerpPosition<Vector>, {
            target: this,
            speed: 20,
        });
        this.#rotationLerp = this.addComponents(C_LerpRotation, {
            target: this,
            speed: 1000,
        });

        this.#highlightEntity = (options.entity.entityType === 'EXPLOSION' ? this._engine : this)
            .addEntities(
                E_TileHighlight,
                options.entity.entityType === 'EXPLOSION'
                    ? { tile: this, scene: GridScene.name }
                    : { tile: this },
            )
            .setZIndex(-1);
        this.#entityVisual = this.#highlightEntity.addEntities(E_EntityVisual, {
            mode: 'tile',
            zIndex: -1,
            tile: this,
        });
        this.#pointerParent = this.#highlightEntity.addEntities(Entity, { name: 'pointer_parent' });

        this.#pointerTarget = this.#pointerParent.addComponents(C_PointerTarget, {
            cursorOnHover: 'pointer',
            cursorPriority: 5,
        });
        this.#pointerTarget.canInteract = false;
        this.#highlightShape = this.#pointerParent.addComponents(C_Shape, {
            name: 'shape',
            shape: 'RECT',
            style: {
                fillStyle: 'white',
            },
            opacity: 0,
            zIndex: 1,
        });
        this.#opacityLerp = this.#pointerParent.addComponents(C_LerpOpacity, {
            target: this.#highlightShape,
            speed: 5,
        });

        this.#canBeReused = this.entity.entityType !== 'EXPLOSION';
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
        this.#entityVisual.variant = variant;
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

        if (hoveredByPointer && this._engine.pointerState[PointerButton.LEFT].clicked) {
            if (this._engine.getKey('Meta').down || this._engine.getKey('Control').down) {
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

            this._engine.capturePointerButtonClick(PointerButton.LEFT);
        }

        this.#opacityLerp.target = active ? ACTIVE_TILE_OPACITY : 0;

        this.#updatePosition();

        return super.update(deltaTime);
    }

    override destroy(): void {
        this.#highlightEntity.destroy();
        this.#entityVisual.destroy();
        super.destroy();
    }

    syncVisualState() {
        const { selectedTiles } = getAppStore();
        this.#highlightShape.setOpacity(this.entity.tID in selectedTiles ? ACTIVE_TILE_OPACITY : 0);
    }

    stashTile(): boolean {
        if (!this.#canBeReused) {
            return false;
        }

        this.initialized = false;
        this.setEnabled(false);
        this.#highlightEntity.setEnabled(false);
        this.#entityVisual.stash();

        return true;
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

        const targetRotation = getLoopholeEntityDegreeRotation(this.#entity);

        const newPosition = enginePosition.mul(TILE_SIZE);
        this.#positionLerp.target = newPosition;
        this.#rotationLerp.target = targetRotation;
        if (!this.#initialized) {
            this.setPosition(newPosition);
            this.setRotation(targetRotation);
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
        if (this.#entity.entityType === 'EXPLOSION' && this._engine.canvasSize) {
            const isHorizontal =
                this.#entity.direction === 'RIGHT' || this.#entity.direction === 'LEFT';
            const scale = zoomToScale(this._engine.camera.zoom);
            const length =
                (isHorizontal ? this._engine.canvasSize.y : this._engine.canvasSize.x) / scale;
            this.#highlightEntity
                .setScale(isHorizontal ? { x: TILE_SIZE, y: length } : { x: length, y: TILE_SIZE })
                .setPosition(
                    isHorizontal
                        ? {
                              x: this.position.x,
                              y: -this._engine.camera.position.y / scale,
                          }
                        : {
                              x: -this._engine.camera.position.x / scale,
                              y: this.position.y,
                          },
                );

            this.#entityVisual.sync();
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
            ...this._engine.addEntities(
                E_InfiniteShape,
                {
                    name: 'border',
                    shapeOptions: {
                        name: 'border',
                        shape: 'RECT',
                        opacity: 0.5,
                        style: {
                            fillStyle: '',
                            strokeStyle: '#BBBBBB',
                            lineWidth: 2,
                        },
                    },
                    tileSize: SCREEN_BORDER_SIZE,
                    offset: {
                        x: SCREEN_BORDER_SIZE.x / 2,
                        y: SCREEN_BORDER_SIZE.y / 2,
                    },
                    scale: SCREEN_BORDER_SIZE,
                    zIndex: -10,
                },
                {
                    name: 'grid',
                    shapeOptions: {
                        name: 'dots',
                        shape: 'ELLIPSE',
                        opacity: 0.5,
                        style: { fillStyle: '#BBBBBB' },
                        gap: DOT_GAP,
                    },
                    tileSize: TILE_SIZE,
                    zoomCullThresh: 0.2,
                    offset: DOT_SIZE / 2,
                    scale: DOT_SIZE,
                    zIndex: -9,
                },
            ),
        );
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
