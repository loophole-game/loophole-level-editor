import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import {
    ENTITY_METADATA,
    ENTITY_TYPE_DRAW_ORDER,
    getLoopholeEntityExtendedType,
    loopholeRotationToDegrees,
    TILE_CENTER_FRACTION,
} from '../../utils';
import type { Loophole_Entity, Loophole_EntityType, Loophole_Int2 } from '../externalLevelSchema';
import { C_PointerTarget } from '../../engine/components/PointerTarget';
import { getAppStore } from '@/utils/store';
import { Component } from '@/utils/engine/components';
import { C_Image } from '@/utils/engine/components/Image';
import type { LevelEditor } from '..';
import { PointerButton } from '@/utils/engine/systems/pointer';

const MAX_OPACITY = 0.6;

class C_PointerVisual extends Component {
    #editor: LevelEditor;
    #facade: E_TileFacade;
    #pointerTarget: C_PointerTarget;
    #shape: C_Shape;

    #opacity: number = 0;

    constructor(
        editor: LevelEditor,
        facade: E_TileFacade,
        pointerTarget: C_PointerTarget,
        shape: C_Shape,
    ) {
        super('PointerVisual');

        this.#editor = editor;
        this.#facade = facade;
        this.#pointerTarget = pointerTarget;
        this.#shape = shape;
        this.#shape.style.globalAlpha = 0;
        this.#shape.setScale({ x: 1.1, y: 1.1 });
    }

    override update(deltaTime: number): boolean {
        const {
            brushEntityType,
            multiselectHoveredTileFacades,
            selectedTileFacades,
            setSelectedTileFacades,
        } = getAppStore();
        const hoveredByPointer = this.#pointerTarget.isPointerHovered && brushEntityType === null;
        const active =
            hoveredByPointer ||
            multiselectHoveredTileFacades[this.entity?.parent?.id.toString() ?? ''] !== undefined ||
            selectedTileFacades[this.entity?.parent?.id.toString() ?? ''] !== undefined;

        if (hoveredByPointer && this.#editor.pointerState[PointerButton.LEFT].clicked) {
            setSelectedTileFacades({
                [this.#facade.id.toString()]: this.#facade,
            });
            this.#editor.capturePointerButtonClick(PointerButton.LEFT);
        }

        const targetOpacity = active ? MAX_OPACITY : 0;
        if (targetOpacity !== this.#opacity) {
            this.#opacity = Math.max(
                0,
                Math.min(MAX_OPACITY, this.#opacity + deltaTime * (active ? 7 : -7)),
            );
            this.#shape.style.globalAlpha = this.#opacity;
            return true;
        } else {
            return false;
        }
    }
}

export class E_TileFacade extends Entity {
    #entity: Loophole_Entity;
    #pointerTarget: C_PointerTarget;

    get pointerTarget(): C_PointerTarget {
        return this.#pointerTarget;
    }

    get entity(): Loophole_Entity {
        return this.#entity;
    }

    set entity(entity: Loophole_Entity) {
        this.#entity = entity;
    }

    constructor(entity: Loophole_Entity, pointerTarget: C_PointerTarget) {
        super('TileFacade');

        this.#entity = entity;
        this.#pointerTarget = pointerTarget;
    }
}

type TileData = {
    parentFacade: E_TileFacade;
    entity: Entity;
    shapeComp: C_Shape;
    shapePointerComp: C_PointerTarget;
    imageComp: C_Image;
    entityType: Loophole_EntityType;
};

export class E_Tile extends Entity {
    #editor: LevelEditor;
    #tilePosition: Loophole_Int2;
    #entities: Loophole_Entity[] = [];
    #entitiesDirty: boolean = true;

    #centerTiles: TileData[] = [];
    #topEdgeTiles: TileData[] = [];
    #rightEdgeTiles: TileData[] = [];

    constructor(
        editor: LevelEditor,
        name: string,
        position: Loophole_Int2,
        ...components: Component[]
    ) {
        super(name, ...components);

        this.#editor = editor;
        this.setPosition(position);
        this.#tilePosition = position;
        this.setScale({ x: TILE_CENTER_FRACTION, y: TILE_CENTER_FRACTION });
    }

    get tilePosition(): Readonly<Loophole_Int2> {
        return this.#tilePosition;
    }

    set tilePosition(position: Loophole_Int2) {
        this.#tilePosition = position;
    }

    get entities(): ReadonlyArray<Loophole_Entity> {
        return this.#entities;
    }

    override update(): boolean {
        if (!this.#entitiesDirty) {
            return false;
        }

        this.#entitiesDirty = false;

        return true;
    }

    override destroy() {
        this.#destroyTiles(this.#centerTiles);
        this.#destroyTiles(this.#topEdgeTiles);
        this.#destroyTiles(this.#rightEdgeTiles);

        super.destroy();
    }

    updateEntities(entities: Loophole_Entity[]) {
        let nextAvailableCenterTileIdx = 0,
            nextAvailableTopEdgeTileIdx = 0,
            nextAvailableRightEdgeTileIdx = 0;
        for (const entity of entities) {
            const { name, tileScale } = ENTITY_METADATA[getLoopholeEntityExtendedType(entity)];
            let tileData: TileData;
            let rotation = 0;

            if ('edgePosition' in entity) {
                const isTop = entity.edgePosition.alignment === 'TOP';
                const dist = 0.5;
                if (isTop) {
                    const topEdgeTile = this.#topEdgeTiles[nextAvailableTopEdgeTileIdx];
                    tileData = this.#getOrCreateTileData(entity, topEdgeTile);
                    if (!topEdgeTile) {
                        this.#topEdgeTiles.push(tileData);
                    }

                    tileData.entity.setPosition({ x: 0, y: -dist });
                    nextAvailableTopEdgeTileIdx++;
                } else {
                    const rightEdgeTile = this.#rightEdgeTiles[nextAvailableRightEdgeTileIdx];
                    tileData = this.#getOrCreateTileData(entity, rightEdgeTile);
                    if (!rightEdgeTile) {
                        this.#rightEdgeTiles.push(tileData);
                    }

                    tileData.entity.setPosition({ x: dist, y: 0 });
                    nextAvailableRightEdgeTileIdx++;
                }

                rotation = loopholeRotationToDegrees(isTop ? 'UP' : 'RIGHT');
            } else {
                const existingTileData = this.#centerTiles[nextAvailableCenterTileIdx];
                tileData = this.#getOrCreateTileData(entity, existingTileData);
                if (!existingTileData) {
                    this.#centerTiles.push(tileData);
                }

                tileData.entity.setPosition({ x: 0, y: 0 });
                nextAvailableCenterTileIdx++;
            }

            if ('rotation' in entity) {
                rotation = loopholeRotationToDegrees(entity.rotation);
            } else if ('flipDirection' in entity) {
                rotation += loopholeRotationToDegrees(entity.flipDirection ? 'LEFT' : 'RIGHT');
            }

            tileData.entityType = entity.entityType;
            tileData.imageComp.imageName = name;
            tileData.entity
                .setEnabled(true)
                .setScale({
                    x: tileScale,
                    y: tileScale,
                })
                .setRotation(rotation);
            tileData.parentFacade.setZIndex(ENTITY_TYPE_DRAW_ORDER[entity.entityType] + 1);
        }

        for (let i = nextAvailableCenterTileIdx; i < this.#centerTiles.length; i++) {
            this.#centerTiles[i].entity.setEnabled(false);
        }
        for (let i = nextAvailableTopEdgeTileIdx; i < this.#topEdgeTiles.length; i++) {
            this.#topEdgeTiles[i].entity.setEnabled(false);
        }
        for (let i = nextAvailableRightEdgeTileIdx; i < this.#rightEdgeTiles.length; i++) {
            this.#rightEdgeTiles[i].entity.setEnabled(false);
        }

        this.#entities = [...entities];
        this.#entitiesDirty = true;
    }

    #getOrCreateTileData(
        entity: Loophole_Entity,
        existingTileData: TileData | null | undefined,
    ): TileData {
        if (existingTileData) {
            return existingTileData;
        }

        const shapeComp = new C_Shape('gridTile', 'RECT', {
            fillStyle: 'red',
        });
        const shapePointerComp = new C_PointerTarget();
        const imageComp = new C_Image('gridTileImage', '', { imageSmoothingEnabled: false });
        const parentFacade = new E_TileFacade(entity, shapePointerComp)
            .setPosition(this.position)
            .setScale(this.scale);
        const gridEntity = new Entity('gridTileEntity')
            .addComponents(
                shapeComp,
                shapePointerComp,
                imageComp,
                new C_PointerVisual(this.#editor, parentFacade, shapePointerComp, shapeComp),
            )
            .setScale(this.scale);
        parentFacade.addChildren(gridEntity);
        window.engine?.addSceneEntities(GridScene.name, parentFacade);

        return {
            parentFacade,
            entity: gridEntity,
            shapeComp,
            shapePointerComp,
            imageComp,
            entityType: 'BUTTON',
        };
    }

    #destroyTiles(tiles: TileData[]) {
        for (const { parentFacade } of tiles) {
            parentFacade.destroy();
        }
    }
}

export class GridScene extends Scene {
    #prevChildrenCount: number = 0;
    override create() {
        this.addEntities(
            new Entity('origin')
                .addComponents(
                    new C_Shape('origin', 'ELLIPSE', {
                        fillStyle: 'white',
                    }),
                )
                .setScale({ x: 12, y: 12 })
                .setZIndex(100),
        );
    }

    override update() {
        if (this.#prevChildrenCount !== this.rootEntity?.children.length) {
            this.#prevChildrenCount = this.rootEntity?.children.length ?? 0;
        }

        return false;
    }
}
