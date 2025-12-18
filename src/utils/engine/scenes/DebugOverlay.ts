import { Scene } from '../systems/scene';
import { Component, type ComponentOptions } from '../components';
import type { RenderCommandStream } from '../systems/render';
import { RENDER_CMD, RenderCommand } from '../systems/render';
import type { Engine } from '..';
import { Entity } from '../entities';
import type { BoundingBox } from '../types';

export class C_BoundingBoxDebug<TEngine extends Engine = Engine> extends Component<TEngine> {
    constructor(options: ComponentOptions<TEngine>) {
        const { name = 'boundingBoxDebug', ...rest } = options;
        super({ name, ...rest });
    }

    override queueRenderCommands(stream: RenderCommandStream): void {
        if (!this._entity) return;

        const inverseWorldMatrix = this._entity.transform.worldMatrix.inverse();
        stream.push(
            new RenderCommand(RENDER_CMD.PUSH_TRANSFORM, {
                t: inverseWorldMatrix,
            }),
        );

        this.#drawEntityBoundingBox(this._engine.rootEntity, stream);

        stream.push(new RenderCommand(RENDER_CMD.POP_TRANSFORM));
        this.#drawBoundingBox(this._engine.camera.boundingBox, stream);
    }

    #drawEntityBoundingBox(entity: Readonly<Entity>, stream: RenderCommandStream, level = 0): void {
        if (!entity.enabled) return;

        const culled = entity.isCulled(this._engine.camera);
        if (!culled) {
            this.#drawBoundingBox(entity.transform.boundingBox, stream, level);
        }

        for (const child of entity.children) {
            this.#drawEntityBoundingBox(child, stream, level + 1);
        }
    }

    #drawBoundingBox(bbox: BoundingBox, stream: RenderCommandStream, level = 0): void {
        stream.setStyle({
            strokeStyle: `rgba(255, 0, 0, ${1 - level * 0.05})`,
            fillStyle: '',
            lineWidth: 1,
        });
        stream.push(
            new RenderCommand(RENDER_CMD.DRAW_RECT, {
                x: bbox.x1,
                y: bbox.y1,
                w: bbox.x2 - bbox.x1,
                h: bbox.y2 - bbox.y1,
            }),
        );
    }
}

export class DebugOverlayScene extends Scene {
    #debugEntity: Entity<Engine> | null = null;

    override create(): void {
        this.#debugEntity = this.add(Entity<Engine>, {
            name: 'boundingBoxDebugEntity',
        });
        this.#debugEntity.addComponents(C_BoundingBoxDebug, {});
    }
}
