import { Scene } from '../systems/scene';
import { Component, type ComponentOptions } from '../components';
import type { RenderCommandStream } from '../systems/render';
import { RENDER_CMD, RenderCommand } from '../systems/render';
import type { Engine } from '..';
import { Entity } from '../entities';

export class C_BoundingBoxDebug<TEngine extends Engine = Engine> extends Component<TEngine> {
    constructor(options: ComponentOptions<TEngine>) {
        const { name = 'boundingBoxDebug', ...rest } = options;
        super({ name, ...rest });
    }

    override queueRenderCommands(out: RenderCommandStream): void {
        if (!this._entity) return;

        const inverseWorldMatrix = this._entity.transform.worldMatrix.inverse();
        out.push(
            new RenderCommand(RENDER_CMD.PUSH_TRANSFORM, null, {
                t: inverseWorldMatrix,
            }),
        );

        this.#drawEntityBoundingBox(this._engine.rootEntity, out);

        out.push(new RenderCommand(RENDER_CMD.POP_TRANSFORM, null));
    }

    #drawEntityBoundingBox(entity: Readonly<Entity>, out: RenderCommandStream, level = 0): void {
        if (!entity.enabled) return;

        const bbox = entity.transform.boundingBox;
        out.push(
            new RenderCommand(
                RENDER_CMD.DRAW_RECT,
                {
                    strokeStyle: `rgba(255, 0, 0, ${1 - level * 0.05})`,
                    fillStyle: '',
                    lineWidth: 1,
                },
                {
                    x: bbox.x1,
                    y: bbox.y1,
                    w: bbox.x2 - bbox.x1,
                    h: bbox.y2 - bbox.y1,
                },
            ),
        );

        for (const child of entity.children) {
            this.#drawEntityBoundingBox(child, out, level + 1);
        }
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
