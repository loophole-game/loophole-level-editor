import { Scene } from '../systems/scene';
import { C_Drawable, type C_DrawableOptions } from '../components';
import { Entity } from '../entities';
import type { BoundingBox, CacheStats } from '../types';
import type { RenderCommandStream } from '../systems/render/command';
import type { RenderStyle } from '../systems/render/style';
import { zoomToScale } from '../utils';
import type { TraceFrame } from '../systems/stats';
import { C_Text } from '../components/Text';

const IMPORTANT_TRACE_THRESHOLD = 0.2;
const IMPORTANT_TRACE_STALE_TIME = 5000;

const HEADER_SIZE = 16;
const LABEL_COLOR = '#CCCCCC';

export class C_StatsDebug extends C_Drawable {
    #text: C_Text;
    #importantTraces: Map<string, number> = new Map();

    constructor(options: C_DrawableOptions) {
        const {
            name = 'statsDebug',
            style = {
                fillStyle: 'white',
                font: '12px monospace',
            },
            ...rest
        } = options;
        super({ name, style, ...rest });

        this.#text = this.entity.addComponents(C_Text, {
            text: '',
            fontSize: 12,
            textAlign: 'top-left',
            trim: 'ends',
        });
    }

    override queueRenderCommands(stream: RenderCommandStream): boolean {
        const stats = this._engine.stats;
        if (!stats) {
            return false;
        }

        const currentTime = performance.now();
        let text = `<size=${HEADER_SIZE}><bold>FPS: ${stats.fps}</bold></size>\n\n`;

        text += this.#buildTraceText(stats.traces, 0, '', currentTime);

        if (stats.renderCommands) {
            text += '\n';
            const renderStats = stats.renderCommands;
            text += this.#buildCacheText('transform', renderStats.transform);
            text += this.#buildCacheText('setStyle', renderStats.setStyle);
            text += this.#buildCacheText('setOpacity', renderStats.setOpacity);
            text += this.#buildCacheText('drawRect', renderStats.drawRect);
            text += this.#buildCacheText('drawEllipse', renderStats.drawEllipse);
            text += this.#buildCacheText('drawLine', renderStats.drawLine);
            text += this.#buildCacheText('drawImage', renderStats.drawImage);
            text += this.#buildCacheText('drawText', renderStats.drawText);
        }

        this.#text.text = text;

        return super.queueRenderCommands(stream);
    }

    #buildTraceText(
        traces: ReadonlyArray<TraceFrame>,
        depth: number,
        parentName: string,
        currentTime: number,
    ): string {
        let text = '';

        for (const trace of traces) {
            const name = trace.name;
            const { subFrames, time, numCalls = 1 } = trace;

            const key = (parentName ? `${parentName} > ${name}` : name).split('(')[0];
            if (depth > 0) {
                if (time >= IMPORTANT_TRACE_THRESHOLD) {
                    this.#importantTraces.set(key, currentTime);
                } else {
                    const lastTime = this.#importantTraces.get(key);
                    if (!lastTime || currentTime - lastTime > IMPORTANT_TRACE_STALE_TIME) {
                        this.#importantTraces.delete(key);
                        continue;
                    }
                }
            }

            const padding = ' '.repeat(depth * 2);
            const traceText = `<color=${LABEL_COLOR}>${name}${numCalls > 1 ? ` (${numCalls})` : ''}:</color> <bold>${time.toFixed(1)}ms</bold>`;
            text += padding + traceText + '\n';

            if (subFrames.length > 0) {
                text += this.#buildTraceText(subFrames, depth + 1, name, currentTime);
            }
        }

        return text;
    }

    #buildCacheText(name: string, stats: CacheStats): string {
        if (stats.total === 0) return '';
        const cachedPercent =
            stats.cached > 0
                ? ` (${((stats.cached / (stats.total + stats.cached)) * 100).toFixed(1)}% cached)`
                : '';
        return `<color=${LABEL_COLOR}>${name}:</color> <bold>${stats.total}${cachedPercent}</bold>\n`;
    }
}

interface BoundingBoxDebugOptions extends C_DrawableOptions {
    sceneEntityName: string;
}

export class C_BoundingBoxDebug extends C_Drawable {
    #sceneEntityName: string;

    constructor(options: BoundingBoxDebugOptions) {
        const { name = 'boundingBoxDebug', ...rest } = options;
        super({ name, ...rest });

        const { sceneEntityName } = options;
        this.#sceneEntityName = sceneEntityName;
    }

    override queueRenderCommands(stream: RenderCommandStream): boolean {
        if (!super.queueRenderCommands(stream)) {
            return false;
        }

        stream.pushTransform(this._entity.transform.worldMatrix.inverse());
        for (const child of this._engine.rootEntity.children) {
            this.#drawEntityBoundingBox(child, stream);
        }
        stream.popTransform();

        this.#drawBoundingBox(this._engine.camera.cullBoundingBox, stream, {
            strokeStyle: 'blue',
            lineWidth: 4 / zoomToScale(this.engine.camera.zoom),
        });

        return true;
    }

    #drawEntityBoundingBox(entity: Readonly<Entity>, stream: RenderCommandStream, level = 0): void {
        if (!entity.enabled || entity.name === this.#sceneEntityName) return;

        const culled =
            entity.cull !== 'none' && entity.isCulled(this._engine.camera.cullBoundingBox);
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
    override create(): void {
        this.add(Entity, {
            name: 'boundingBoxEntity',
            cull: 'none',
        }).addComponents(C_BoundingBoxDebug, { sceneEntityName: this.rootEntity.name });

        this.add(Entity, {
            name: 'statsEntity',
            cull: 'none',
            positionRelativeToCamera: { x: 'end', y: 'end' },
            scaleRelativeToCamera: true,
            position: -24,
        }).addComponents(C_StatsDebug, { name: 'statsDebug' });
    }
}
