import { Scene } from '../systems/scene';
import { Component, type ComponentOptions } from '../components';
import type { Engine } from '..';
import { Entity } from '../entities';
import type { BoundingBox } from '../types';
import type { RenderCommandStream } from '../systems/render/command';
import type { RenderStyle } from '../systems/render/style';
import { zoomToScale } from '../utils';

export class C_BoundingBoxDebug<TEngine extends Engine = Engine> extends Component<TEngine> {
    constructor(options: ComponentOptions<TEngine>) {
        const { name = 'boundingBoxDebug', ...rest } = options;
        super({ name, ...rest });
    }

    override queueRenderCommands(stream: RenderCommandStream): void {
        if (!this._entity) return;

        stream.pushTransform(this._entity.transform.worldMatrix.inverse());
        this.#drawEntityBoundingBox(this._engine.rootEntity, stream);
        stream.popTransform();

        this.#drawBoundingBox(this._engine.camera.cullBoundingBox, stream, {
            strokeStyle: 'blue',
            lineWidth: 4 / zoomToScale(this.engine.camera.zoom),
        });
    }

    #drawEntityBoundingBox(entity: Readonly<Entity>, stream: RenderCommandStream, level = 0): void {
        if (!entity.enabled || entity === this.entity) return;

        const culled = entity.cull !== 'none' && entity.isCulled(this._engine.camera.cullBoundingBox);
        if (culled && entity.cull === 'all') {
            return;
        }

        if (!culled) {
            this.#drawBoundingBox(entity.transform.boundingBox, stream, {
                strokeStyle: `rgba(255, 0, 0, ${1 - level * 0.05})`,
                fillStyle: '',
                lineWidth: 1,
            });
        }

        const cullChildren = culled && entity.cull === 'components';
        if (!cullChildren) {
            for (const child of entity.children) {
                this.#drawEntityBoundingBox(child, stream, level + 1);
            }
        }
    }

    #drawBoundingBox(bbox: BoundingBox, stream: RenderCommandStream, style: RenderStyle): void {
        stream.setOpacity(1);
        stream.setStyle(style);
        stream.drawRect(bbox.x1, bbox.y1, bbox.x2 - bbox.x1, bbox.y2 - bbox.y1, 1, 1, 1, 1);
    }
}

export class DebugOverlayScene extends Scene {
    #debugEntity: Entity<Engine> | null = null;

    override create(): void {
        this.#debugEntity = this.add(Entity<Engine>, {
            name: 'boundingBoxDebugEntity',
            cull: 'none',
        });
        this.#debugEntity.addComponents(C_BoundingBoxDebug, {});
    }
}
