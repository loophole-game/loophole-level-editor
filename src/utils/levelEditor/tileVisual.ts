import { C_Image } from '../engine/components/Image';
import { C_Shape, type Shape } from '../engine/components/Shape';
import { Entity } from '../engine/entities';
import type { RenderStyle } from '../engine/systems/render';
import { ENTITY_METADATA, getLoopholeWireSprite, WIRE_CORNER_SPRITE } from '../utils';
import type { Loophole_EntityWithID, Loophole_ExtendedEntityType } from './externalLevelSchema';

export class E_EntityVisual extends Entity {
    #tileImage: C_Image;
    #tileShapes: C_Shape[] = [];

    #style: RenderStyle = {};

    #type: Loophole_ExtendedEntityType | null = null;

    constructor() {
        super('entity_visual');
        this.#tileImage = new C_Image('entity_visual', '', {
            imageSmoothingEnabled: false,
        });
        this.addComponents(this.#tileImage);
    }

    get style(): RenderStyle {
        return this.#style;
    }

    set style(style: RenderStyle) {
        console.log('setting style', style);
        this.#style = style;
        this.#tileImage.style.globalAlpha = style.globalAlpha ?? 1;
        this.#tileShapes.forEach((shape) => {
            shape.style.globalAlpha = style.globalAlpha ?? 1;
        });
    }

    onEntityChanged(type: Loophole_ExtendedEntityType, entity?: Loophole_EntityWithID) {
        if (this.#type === type) {
            return;
        }

        this.#type = type;
        this.#requestTileShapes();
        this.#tileImage.imageName = '';

        const { name } = ENTITY_METADATA[type];
        switch (type) {
            case 'EXPLOSION': {
                this.#requestTileShapes('RECT');
                this.#tileShapes[0].style.fillStyle = 'orange';
                break;
            }
            default:
                switch (type) {
                    case 'WIRE': {
                        const wireSprite = entity && getLoopholeWireSprite(entity);
                        this.#tileImage.imageName =
                            wireSprite === 'CORNER' ? WIRE_CORNER_SPRITE : name;
                        break;
                    }
                    default:
                        this.#tileImage.imageName = name;
                        break;
                }
        }
    }

    #requestTileShapes(...shapes: Shape[]) {
        while (this.#tileShapes.length < shapes.length) {
            const shape = new C_Shape('tile', 'RECT');
            this.#tileShapes.push(shape);
            this.addComponents(shape);
        }

        for (let i = 0; i < shapes.length; i++) {
            if (i < shapes.length) {
                this.#tileShapes[i].setEnabled(true);
                this.#tileShapes[i].shape = shapes[i];
            } else {
                this.#tileShapes[i].setEnabled(false);
            }
        }

        return this.#tileShapes.slice(0, shapes.length);
    }
}
