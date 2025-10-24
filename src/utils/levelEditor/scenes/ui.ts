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
import type { Loophole_EdgeAlignment } from '../externalLevelSchema';
import { PointerButton } from '@/utils/engine/systems/pointer';
import type { Position } from '@/utils/engine/types';
import type { LevelEditor } from '..';
import { C_Lerp } from '@/utils/engine/components/Lerp';
import { positionsEqual } from '@/utils/engine/utils';
import { C_Shape } from '@/utils/engine/components/Shape';
import { E_TileFacade } from './grid';

const POSITION_SPEED = 20;
const ROTATION_SPEED = 1000;

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
            type: 'fractional',
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
        const updated = super.update(deltaTime);
        if (!window.engine) return updated;

        const {
            brushEntityType,
            brushEntityRotation,
            setBrushEntityRotation,
            brushEntityFlipDirection,
            setBrushEntityFlipDirection,
        } = getAppStore();
        if (
            !multiSelectIsActive(this.#editor) &&
            !cameraDragIsActive(this.#editor) &&
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

            this.setScale({ x: TILE_SIZE * tileScaleOverride, y: TILE_SIZE * tileScaleOverride });
            if (!this.#active) {
                this.setPosition(this.#targetPosition);
                this.setRotation(this.#targetRotation ?? 0);
            }

            if (this.#editor.getPointerButton(PointerButton.LEFT).clicked) {
                this.#editor.placeTile(
                    tilePosition,
                    brushEntityType,
                    edgeAlignment,
                    brushEntityRotation,
                    brushEntityFlipDirection,
                );
            } else if (this.#editor.getPointerButton(PointerButton.RIGHT).clicked) {
                this.#editor.removeTile(tilePosition, positionType, type, edgeAlignment);
            }

            this.#active = true;
        } else {
            this.#targetPosition = null;
            this.#active = false;
        }

        this.#positionLerp.target = this.#targetPosition ?? this.position;
        this.#tileOpacityLerp.target = this.#active ? 0.5 : 0;
        this.#tileRotationLerp.target = this.#targetRotation ?? this.rotation;

        return updated;
    }
}

class E_SelectionCursor extends Entity {
    #editor: LevelEditor;
    #shapeComp: C_Shape;
    #opacityLerp: C_Lerp<number>;

    #selectAllClickPosition: Position | null = null;
    #active: boolean = false;

    constructor(editor: LevelEditor) {
        const shapeComp = new C_Shape('rect', 'RECT', {
            fillStyle: 'blue',
        }).setOrigin({ x: 0, y: 0 });
        super('ms_cursor', shapeComp);

        this.#editor = editor;
        this.#shapeComp = shapeComp;
        this.#opacityLerp = new C_Lerp<number>({
            get: (() => this.#shapeComp.style.globalAlpha ?? 0).bind(this),
            set: ((value: number) => {
                this.#shapeComp.style.globalAlpha = value;
            }).bind(this),
            speed: 5,
        });
        this.addComponents(this.#opacityLerp);
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);
        const pointerPosition = { ...this.#editor.pointerState.worldPosition };
        const prevActive = this.#active;

        const {
            brushEntityType,
            multiselectHoveredTileFacades,
            setMultiselectHoveredTileFacades,
            setSelectedTileFacades,
        } = getAppStore();
        const leftButtonState = this.#editor.getPointerButton(PointerButton.LEFT);
        if (leftButtonState.pressed) {
            this.#selectAllClickPosition = pointerPosition;
        } else if (leftButtonState.released || !this.#editor.pointerState.onScreen) {
            if (
                this.#selectAllClickPosition &&
                leftButtonState.released &&
                !leftButtonState.clicked
            ) {
                setSelectedTileFacades(multiselectHoveredTileFacades);
            }
            this.#selectAllClickPosition = null;
        }

        if (
            (multiSelectIsActive(this.#editor) || !brushEntityType) &&
            !cameraDragIsActive(this.#editor)
        ) {
            if (
                leftButtonState.down &&
                this.#selectAllClickPosition &&
                !positionsEqual(pointerPosition, this.#selectAllClickPosition)
            ) {
                if (!this.#active) {
                    setSelectedTileFacades({});
                }

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

                const hoveredFacades = this.#editor.pointerSystem
                    .getPointerTargetsWithinBox(topLeft, bottomRight)
                    .map((t) => t.entity?.parent)
                    .filter((e) => e?.typeString === E_TileFacade.name) as E_TileFacade[];
                const hoveredFacadeMap = Object.fromEntries(
                    hoveredFacades.map((f) => [f.id.toString(), f]),
                );
                setMultiselectHoveredTileFacades(hoveredFacadeMap);

                updated = true;
                this.#active = true;
            } else {
                this.#active = false;
            }
        } else {
            this.#active = false;
        }

        if (!this.#active && prevActive) {
            setMultiselectHoveredTileFacades({});
        }

        this.#opacityLerp.target = this.#active ? 0.25 : 0;

        return updated;
    }
}

export class UIScene extends Scene {
    override create(editor: LevelEditor) {
        this.rootEntity?.setZIndex(100);

        this.addEntities(new E_SelectionCursor(editor), new E_TileCursor(editor));
    }

    override update(): boolean {
        const { brushEntityType, setBrushEntityType } = getAppStore();
        if (brushEntityType && window.engine?.getKey('Escape').pressed) {
            setBrushEntityType(null);
        }

        return false;
    }
}
