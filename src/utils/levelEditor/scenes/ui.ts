import {
    degreesToLoopholeRotation,
    ENTITY_METADATA,
    loopholePositionToEnginePosition,
    loopholeRotationToDegrees,
    TILE_SIZE,
} from '@/utils/utils';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import { C_Image } from '@/utils/engine/components/Image';
import { getAppStore } from '@/utils/store';
import type { Loophole_EdgeAlignment, Loophole_ExtendedEntityType } from '../externalLevelSchema';
import { PointerButton } from '@/utils/engine/systems/pointer';
import type { Position } from '@/utils/engine/types';
import type { LevelEditor } from '..';
import { C_Lerp } from '@/utils/engine/components/Lerp';

const TARGET_OPACITY = 0.5;
const POSITION_SPEED = 1900;
const ROTATION_SPEED = 10;

type CursorMode = 'HIDDEN' | 'TILE' | 'MULTI_SELECT';

class E_Cursor extends Entity {
    #editor: LevelEditor;
    #tileImage: C_Image;

    #positionLerp: C_Lerp<Position>;
    #tileOpacityLerp: C_Lerp<number>;
    #tileRotationLerp: C_Lerp<number>;

    #targetPosition: Position | null = null;
    #targetRotation: number | null = null;
    #mode: CursorMode = 'HIDDEN';

    constructor(editor: LevelEditor) {
        const tileImageComp = new C_Image('cursor', ENTITY_METADATA['MUSHROOM_BLUE'].name, {
            imageSmoothingEnabled: false,
            globalAlpha: 0,
        });

        super('cursor', tileImageComp);

        this.#editor = editor;
        this.setZIndex(50);
        this.#tileImage = tileImageComp;
        this.#tileOpacityLerp = new C_Lerp<number>({
            get: (() => this.#tileImage.style.globalAlpha ?? 0).bind(this),
            set: ((value: number) => {
                this.#tileImage.style.globalAlpha = value;
            }).bind(this),
            speed: 5,
        });
        this.addComponents(this.#tileOpacityLerp);

        this.#positionLerp = new C_Lerp<Position>({
            get: (() => this.position).bind(this),
            set: ((value: Position) => {
                this.setPosition(value);
            }).bind(this),
            speed: POSITION_SPEED,
        });
        this.addComponents(this.#positionLerp);

        this.#tileRotationLerp = new C_Lerp<number>({
            get: (() => this.rotation).bind(this),
            set: ((value: number) => {
                this.setRotation(value);
            }).bind(this),
            speed: ROTATION_SPEED,
            variant: 'degrees',
        });
        this.addComponents(this.#tileRotationLerp);
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);
        if (!window.engine) return updated;

        const { selectedEntityType } = getAppStore();
        if (window.engine.getPointerButton(PointerButton.RIGHT).down) {
            this.#mode = 'HIDDEN';
        } else if (window.engine.getKey('Shift').down) {
            this.#updateMultiSelectMode();
        } else if (window.engine?.pointerState.onScreen && selectedEntityType) {
            this.#updateTileMode(selectedEntityType);
            updated = true;
        } else {
            this.#targetPosition = null;
            this.#mode = 'HIDDEN';
        }

        this.#positionLerp.target = this.#targetPosition ?? this.position;
        this.#tileOpacityLerp.target = this.#mode === 'TILE' ? TARGET_OPACITY : 0;
        this.#tileRotationLerp.target = this.#targetRotation ?? this.rotation;

        return updated;
    }

    #updateTileMode(selectedEntityType: Loophole_ExtendedEntityType) {
        const {
            selectedEntityRotation,
            setSelectedEntityRotation,
            selectedEntityFlipDirection,
            setSelectedEntityFlipDirection,
        } = getAppStore();
        if (!window.engine) return;

        const {
            positionType,
            name,
            tileScale: tileScaleOverride,
            hasRotation,
            hasFlipDirection,
            type,
        } = ENTITY_METADATA[selectedEntityType];
        this.#tileImage.imageName = name;

        let tilePosition: Position = { x: 0, y: 0 },
            cursorPosition: Position = { x: 0, y: 0 };
        let edgeAlignment: Loophole_EdgeAlignment = 'RIGHT';

        if (positionType === 'CELL') {
            cursorPosition = {
                x: Math.round(window.engine.pointerState.worldPosition.x / TILE_SIZE),
                y: Math.round(window.engine.pointerState.worldPosition.y / TILE_SIZE),
            };
            this.#targetRotation = 0;
        } else {
            const cellX = Math.round(window.engine.pointerState.worldPosition.x / TILE_SIZE);
            const cellY = Math.round(window.engine.pointerState.worldPosition.y / TILE_SIZE);
            const localX = window.engine.pointerState.worldPosition.x - cellX * TILE_SIZE;
            const localY = window.engine.pointerState.worldPosition.y - cellY * TILE_SIZE;

            if (Math.abs(localX) > Math.abs(localY)) {
                cursorPosition = {
                    x: localX > 0 ? cellX + 0.5 : cellX - 0.5,
                    y: cellY,
                };
                edgeAlignment = 'RIGHT';
                this.#targetRotation = loopholeRotationToDegrees('RIGHT');
            } else {
                cursorPosition = {
                    x: cellX,
                    y: localY > 0 ? cellY + 0.5 : cellY - 0.5,
                };
                edgeAlignment = 'TOP';
                this.#targetRotation = loopholeRotationToDegrees('UP');
            }
        }

        tilePosition = loopholePositionToEnginePosition(cursorPosition);
        tilePosition = {
            x: Math.floor(tilePosition.x),
            y: Math.floor(tilePosition.y),
        };

        this.#targetPosition = {
            x: cursorPosition.x * TILE_SIZE,
            y: cursorPosition.y * TILE_SIZE,
        };
        if (this.#mode !== 'TILE') {
            this.setPosition(this.#targetPosition);
        }

        let _selectedEntityRotation = selectedEntityRotation;
        let _selectedEntityFlipDirection = selectedEntityFlipDirection;
        if (this.#editor.getKey('r').pressed) {
            if (hasRotation) {
                _selectedEntityRotation = degreesToLoopholeRotation(
                    loopholeRotationToDegrees(selectedEntityRotation) + 90,
                );
                setSelectedEntityRotation(_selectedEntityRotation);
            } else if (hasFlipDirection) {
                _selectedEntityFlipDirection = !selectedEntityFlipDirection;
                setSelectedEntityFlipDirection(_selectedEntityFlipDirection);
            }
        }

        if (hasRotation) {
            this.#targetRotation =
                (this.#targetRotation + loopholeRotationToDegrees(_selectedEntityRotation)) % 360;
        } else if (hasFlipDirection && _selectedEntityFlipDirection) {
            this.#targetRotation += 180;
        }

        this.setScale({ x: TILE_SIZE * tileScaleOverride, y: TILE_SIZE * tileScaleOverride });
        if (this.#mode !== 'TILE') {
            this.setPosition(this.#targetPosition);
            this.setRotation(this.#targetRotation ?? 0);
        }

        if (this.#editor.getPointerButton(PointerButton.LEFT).clicked) {
            this.#editor.placeTile(
                tilePosition,
                selectedEntityType,
                edgeAlignment,
                selectedEntityRotation,
                selectedEntityFlipDirection,
            );
        } else if (this.#editor.getPointerButton(PointerButton.RIGHT).clicked) {
            this.#editor.removeTile(tilePosition, positionType, type, edgeAlignment);
        }

        this.#mode = 'TILE';
    }

    #updateMultiSelectMode() {
        if (!window.engine) return;

        this.#mode = 'MULTI_SELECT';
    }
}

export class UIScene extends Scene {
    override create(editor: LevelEditor) {
        this.rootEntity?.setZIndex(100);

        this.addEntities(new E_Cursor(editor));
    }
}
