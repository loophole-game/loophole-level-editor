import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import type { Loophole_EntityWithID } from '../externalLevelSchema';
import { C_PointerTarget } from '../../engine/components/PointerTarget';
import { getAppStore } from '@/utils/store';
import { C_Image } from '@/utils/engine/components/Image';
import type { LevelEditor } from '..';
import { PointerButton } from '@/utils/engine/systems/pointer';
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

const ACTIVE_TILE_OPACITY = 0.3;
const TILE_HIGHLIGHT_SCALE_MULT = 1.1;

export class E_Tile extends Entity {
    #editor: LevelEditor;
    #entity: Loophole_EntityWithID;
    #initialized: boolean = false;

    #tileImage: C_Image;
    #positionLerp: C_Lerp<Position>;

    #highlightEntity: Entity;
    #pointerTarget: C_PointerTarget;
    #highlightShape: C_Shape;
    #opacityLerp: C_Lerp<number>;

    constructor(editor: LevelEditor, entity: Loophole_EntityWithID) {
        super('tile');

        this.#editor = editor;
        this.#entity = entity;
        this.#tileImage = new C_Image('tile', '', {
            imageSmoothingEnabled: false,
        });
        this.#positionLerp = new C_LerpPosition(this, 20);
        this.addComponents(this.#tileImage, this.#positionLerp);

        this.#highlightEntity = new Entity('target');
        this.#pointerTarget = new C_PointerTarget();
        this.#highlightShape = new C_Shape('shape', 'RECT', {
            fillStyle: 'white',
            globalAlpha: 0,
        });
        this.#opacityLerp = new C_LerpOpacity(this.#highlightShape, 5);
        this.#highlightEntity.addComponents(
            this.#pointerTarget,
            this.#highlightShape,
            this.#opacityLerp,
        );

        this.addChildren(this.#highlightEntity);
    }

    get entity(): Loophole_EntityWithID {
        return this.#entity;
    }

    set entity(entity: Loophole_EntityWithID) {
        this.#entity = entity;
        this.#onEntityChanged();
    }

    get initialized(): boolean {
        return this.#initialized;
    }

    set initialized(initialized: boolean) {
        this.#initialized = initialized;
    }

    override update(deltaTime: number) {
        const { brushEntityType, selectedTiles, setSelectedTiles } = getAppStore();
        const hoveredByPointer = this.#pointerTarget.isPointerHovered && brushEntityType === null;
        const active = hoveredByPointer || selectedTiles[this.entity.id] !== undefined;

        if (hoveredByPointer && this.#editor.pointerState[PointerButton.LEFT].clicked) {
            if (this.#editor.getKey('Meta').down || this.#editor.getKey('Control').down) {
                const newSelectedTiles = { ...selectedTiles };
                if (this.entity.id in newSelectedTiles) {
                    delete newSelectedTiles[this.entity.id];
                } else {
                    newSelectedTiles[this.entity.id] = this;
                }
                setSelectedTiles(Object.values(newSelectedTiles));
            } else {
                setSelectedTiles([this]);
            }

            this.#editor.capturePointerButtonClick(PointerButton.LEFT);
        }

        this.#opacityLerp.target = active ? ACTIVE_TILE_OPACITY : 0;

        return super.update(deltaTime);
    }

    syncVisualState() {
        const { selectedTiles } = getAppStore();
        this.#highlightShape.style.globalAlpha =
            this.entity.id in selectedTiles ? ACTIVE_TILE_OPACITY : 0;
    }

    #onEntityChanged() {
        const loopholePosition = getLoopholeEntityPosition(this.#entity);
        const edgeAlignment = getLoopholeEntityEdgeAlignment(this.#entity);
        const enginePosition = loopholePositionToEnginePosition(loopholePosition, edgeAlignment);
        const extendedType = getLoopholeEntityExtendedType(this.#entity);
        const positionType = getLoopholeEntityPositionType(this.#entity);
        const { name, tileScale: tileScaleOverride = 1 } = ENTITY_METADATA[extendedType];

        this.setScale({
            x: tileScaleOverride * TILE_SIZE,
            y: tileScaleOverride * TILE_SIZE,
        });
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

        this.setZIndex(ENTITY_TYPE_DRAW_ORDER[this.#entity.entityType] + 1);
        this.#tileImage.imageName = name;
        this.#highlightEntity.setScale(
            positionType === 'CELL'
                ? {
                      x: TILE_HIGHLIGHT_SCALE_MULT,
                      y: TILE_HIGHLIGHT_SCALE_MULT,
                  }
                : {
                      x: 0.3 * TILE_HIGHLIGHT_SCALE_MULT,
                      y: TILE_HIGHLIGHT_SCALE_MULT,
                  },
        );
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
