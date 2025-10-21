import { ENTITY_METADATA, loopholePositionToEnginePosition, TILE_SIZE } from '@/utils/utils';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import { C_Image } from '@/utils/engine/components/Image';
import { getAppStore } from '@/utils/store';
import type { Loophole_EdgeAlignment } from '../externalLevelSchema';
import { MouseButton } from '@/utils/engine/systems/pointer';
import type { Editor } from '..';
import type { Position } from '@/utils/engine/types';

class E_Cursor extends Entity {
    #editor: Editor;
    #image: C_Image;

    constructor(editor: Editor) {
        const comp = new C_Image('cursor', ENTITY_METADATA['MUSHROOM_BLUE'].name, {
            imageSmoothingEnabled: false,
            globalAlpha: 0,
        });

        super('cursor', comp);

        this.#editor = editor;
        this.setZIndex(50);
        this.#image = comp;
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);

        const { selectedEntityType } = getAppStore();
        let active = false;
        if (window.engine.pointerState.onScreen && selectedEntityType) {
            const {
                positionType,
                name,
                tileScale: tileScaleOverride,
            } = ENTITY_METADATA[selectedEntityType];
            this.#image.imageName = name;

            let tilePosition: Position = { x: 0, y: 0 },
                cursorPosition: Position = { x: 0, y: 0 };
            let edgeAlignment: Loophole_EdgeAlignment = 'RIGHT';
            if (positionType === 'CELL') {
                cursorPosition = {
                    x: Math.round(window.engine.pointerState.worldPosition.x / TILE_SIZE),
                    y: Math.round(window.engine.pointerState.worldPosition.y / TILE_SIZE),
                };
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

                    this.setRotation(0);
                } else {
                    cursorPosition = {
                        x: cellX,
                        y: localY > 0 ? cellY + 0.5 : cellY - 0.5,
                    };
                    edgeAlignment = 'TOP';

                    this.setRotation(270);
                }
            }

            tilePosition = loopholePositionToEnginePosition(cursorPosition);
            tilePosition = {
                x: Math.floor(tilePosition.x),
                y: Math.floor(tilePosition.y),
            };

            this.setPosition({
                x: cursorPosition.x * TILE_SIZE,
                y: cursorPosition.y * TILE_SIZE,
            });
            this.setScale({ x: TILE_SIZE * tileScaleOverride, y: TILE_SIZE * tileScaleOverride });

            if (window.engine.pointerState[MouseButton.LEFT].pressed) {
                this.#editor.placeTile(tilePosition, selectedEntityType, edgeAlignment);
            }
            active = true;
            updated = true;
        }

        const targetOpacity = active ? 1 : 0;
        const opacity = this.#image.style.globalAlpha ?? 1;
        if (opacity !== targetOpacity) {
            this.#image.style.globalAlpha = Math.max(
                0,
                Math.min(1, opacity + deltaTime * (active ? 10 : -10)),
            );
            updated = true;
        }

        return updated;
    }
}

export class UIScene extends Scene {
    override create(editor: Editor) {
        this.rootEntity?.setZIndex(100);

        this.addEntities(new E_Cursor(editor));
    }
}
