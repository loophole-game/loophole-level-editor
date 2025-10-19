import { C_CameraDrag } from '../../engine/components/CameraDrag';
import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import { MouseButton } from '../../engine/types';

const CURSOR_SIZE = 8;

class E_Cursor extends Entity {
    #shapeComp: C_Shape;
    #opacity: number = 0;

    constructor() {
        const comp = new C_Shape('cursor', 'ELLIPSE', {
            fillStyle: 'blue',
            strokeStyle: 'white',
            lineWidth: 2,
            globalAlpha: 0,
        });

        super('cursor', comp, new C_CameraDrag(MouseButton.MIDDLE, MouseButton.RIGHT));

        this.setScale({ x: CURSOR_SIZE, y: CURSOR_SIZE });
        this.setZIndex(50);
        this.#shapeComp = comp;
    }

    override update(deltaTime: number): boolean {
        let updated = super.update(deltaTime);

        const position = window.engine.mouseToWorld(window.engine.mouseState);
        if (
            position.x !== this._transform.position.x ||
            position.y !== this._transform.position.y
        ) {
            this.setPosition(position);
            updated = true;
        }

        const active = window.engine.mouseState.onScreen;
        const targetOpacity = active ? 1 : 0;
        if (this.#opacity !== targetOpacity) {
            this.#opacity = Math.max(
                0,
                Math.min(1, this.#opacity + deltaTime * (active ? 5 : -10)),
            );
            this.#shapeComp.style.globalAlpha = this.#opacity;
            updated = true;
        }

        const targetScale = this._transform.scale.x / window.engine.camera.zoom;
        if (this._transform.scale.x !== targetScale) {
            this.setScale({ x: targetScale, y: targetScale });
            updated = true;
        }

        return updated;
    }
}

export class UIScene extends Scene {
    override create() {
        this.rootEntity?.setZIndex(100);

        this.addEntities(new E_Cursor());
    }
}
