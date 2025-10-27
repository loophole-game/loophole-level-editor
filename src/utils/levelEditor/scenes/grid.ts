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
    getLoopholeEntityEdgeAlignment,
    getLoopholeEntityExtendedType,
    getLoopholeEntityPosition,
    loopholePositionToEnginePosition,
} from '@/utils/utils';
import { C_Lerp } from '@/utils/engine/components/Lerp';

export class E_Tile extends Entity {
    #editor: LevelEditor;
    #entity: Loophole_EntityWithID;

    #tileImage: C_Image;
    #pointerTarget: C_PointerTarget;
    #opacityLerp: C_Lerp<number>;

    constructor(editor: LevelEditor, entity: Loophole_EntityWithID) {
        super('tile');

        this.#editor = editor;
        this.#entity = entity;
        this.#tileImage = new C_Image('tile', '', {
            imageSmoothingEnabled: false,
        });
        this.addComponents(this.#tileImage);

        const targetEntity = new Entity('target');
        this.#pointerTarget = new C_PointerTarget();
        const shapeComp = new C_Shape('shape', 'RECT', {
            fillStyle: 'white',
            globalAlpha: 0,
        });
        this.#opacityLerp = new C_Lerp({
            get: (() => {
                console.log('value', shapeComp.style.globalAlpha);
                return shapeComp.style.globalAlpha ?? 0;
            }).bind(this),
            set: ((value: number) => {
                shapeComp.style.globalAlpha = value;
            }).bind(this),
            speed: 5,
        });
        targetEntity.addComponents(this.#pointerTarget, shapeComp, this.#opacityLerp);
        this.addChildren(targetEntity);
        console.log('value', shapeComp.style.globalAlpha);

        this.#onEntityChanged();
    }

    get entity(): Loophole_EntityWithID {
        return this.#entity;
    }

    set entity(entity: Loophole_EntityWithID) {
        this.#entity = entity;
        this.#onEntityChanged();
    }

    override update() {
        const { brushEntityType, selectedTiles, multiselectHoveredTiles } = getAppStore();
        const hoveredByPointer = this.#pointerTarget.isPointerHovered && brushEntityType === null;
        const active =
            hoveredByPointer ||
            multiselectHoveredTiles[this.entity.id.toString()] !== undefined ||
            selectedTiles[this.entity.id.toString()] !== undefined;

        if (hoveredByPointer && this.#editor.pointerState[PointerButton.LEFT].clicked) {
            // TODO: Handle left click on tile
            this.#editor.capturePointerButtonClick(PointerButton.LEFT);
        }

        this.#opacityLerp.target = active ? 0.6 : 0;

        return false;
    }

    #onEntityChanged() {
        const loopholePosition = getLoopholeEntityPosition(this.#entity);
        const edgeAlignment = getLoopholeEntityEdgeAlignment(this.#entity);
        const enginePosition = loopholePositionToEnginePosition(loopholePosition, edgeAlignment);
        this.setPosition({
            x: enginePosition.x * this.scale.x,
            y: enginePosition.y * this.scale.y,
        });

        const extendedType = getLoopholeEntityExtendedType(this.#entity);
        const { name } = ENTITY_METADATA[extendedType];
        this.#tileImage.imageName = name;
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
