import { System } from '..';
import { ItemCache } from '../../itemCache';
import type { Entity } from '../../entities';
import { HashFactory } from '../../hashFactory';
import type { Camera } from '../../types';
import { zoomToScale } from '../../utils';
import { RenderCommandStream, RenderCommandType } from './command';
import { DEFAULT_RENDER_STYLE, TRANSPARENT_STYLE_COLOR, type RenderStyle } from './style';
import type { LoadedImage } from '../image';

interface CanvasStyle extends RenderStyle {
    globalAlpha?: number;
}

export class RenderSystem extends System {
    #stream: RenderCommandStream | null = null;

    #hashedMaterials: HashFactory<RenderStyle> = new HashFactory<RenderStyle>(
        (style: RenderStyle) => {
            return `${style.fillStyle ?? DEFAULT_RENDER_STYLE.fillStyle}|${
                style.strokeStyle ?? DEFAULT_RENDER_STYLE.strokeStyle
            }|${style.lineWidth ?? DEFAULT_RENDER_STYLE.lineWidth}|${
                style.lineJoin ?? DEFAULT_RENDER_STYLE.lineJoin
            }|${style.lineCap ?? DEFAULT_RENDER_STYLE.lineCap}|${
                style.imageSmoothingEnabled ?? DEFAULT_RENDER_STYLE.imageSmoothingEnabled
            }`;
        },
    );
    #hashedImages: HashFactory<string> = new HashFactory<string>((image) => image);

    #imageCache = new ItemCache<Readonly<LoadedImage>, number>((imageID: number) => {
        const id = this.#hashedImages.idToItem(imageID);
        if (id === null) {
            return null;
        }

        return this._engine.getImage(id.value);
    });

    #canvasStateCache: CanvasStyle = {};
    #transformScaleStack: number[] = [];

    destroy(): void {}

    render(ctx: CanvasRenderingContext2D, rootEntity: Entity, camera: Camera) {
        if (!this.#stream) {
            this.#stream = new RenderCommandStream(this.#hashedMaterials, this.#hashedImages);
        } else {
            this.#stream.clear();
        }

        this.#stream.pushTransform(
            new DOMMatrix()
                .translate(camera.position.x, camera.position.y)
                .rotate(camera.rotation)
                .scale(zoomToScale(camera.zoom)),
        );

        this._engine.trace(`queueCommands`, () => {
            rootEntity.queueRenderCommands(this.#stream!, camera);
        });

        this._engine.trace(`renderCommands(${this.#stream.commandCount})`, () => {
            this.#renderCommands(ctx);
        });
    }

    #renderCommands(ctx: CanvasRenderingContext2D) {
        let opacity = 1;
        const activeStyle = { ...DEFAULT_RENDER_STYLE };
        this.#canvasStateCache = {};
        this.#transformScaleStack = [1];
        this.#applyStyle(ctx, {
            ...activeStyle,
            globalAlpha: opacity,
        });

        let dataPointer = 0;
        const data = this.#stream!.data;
        const commands = this.#stream!.commands;
        const commandCount = this.#stream!.commandCount;
        for (let i = 0; i < commandCount; i++) {
            const commandType = commands[i] as RenderCommandType;
            switch (commandType) {
                case RenderCommandType.PUSH_TRANSFORM: {
                    ctx.save();
                    const a = data[dataPointer++];
                    const b = data[dataPointer++];
                    const c = data[dataPointer++];
                    const d = data[dataPointer++];
                    const e = data[dataPointer++];
                    const f = data[dataPointer++];
                    ctx.transform(a, b, c, d, e, f);

                    const scaleX = Math.hypot(a, b);
                    const scaleY = Math.hypot(c, d);
                    const maxScale = Math.max(scaleX || 1, scaleY || 1) || 1;
                    this.#transformScaleStack.push(maxScale);

                    break;
                }
                case RenderCommandType.POP_TRANSFORM:
                    ctx.restore();
                    this.#transformScaleStack.pop();

                    break;
                case RenderCommandType.SET_MATERIAL: {
                    const styleID = data[dataPointer++];
                    const style = this.#hashedMaterials.idToItem(styleID);
                    if (style) {
                        activeStyle.fillStyle =
                            style.value.fillStyle ?? DEFAULT_RENDER_STYLE.fillStyle;
                        activeStyle.strokeStyle =
                            style.value.strokeStyle ?? DEFAULT_RENDER_STYLE.strokeStyle;
                        activeStyle.lineWidth =
                            style.value.lineWidth ?? DEFAULT_RENDER_STYLE.lineWidth;
                        activeStyle.lineJoin =
                            style.value.lineJoin ?? DEFAULT_RENDER_STYLE.lineJoin;
                        activeStyle.lineCap = style.value.lineCap ?? DEFAULT_RENDER_STYLE.lineCap;
                        activeStyle.imageSmoothingEnabled =
                            style.value.imageSmoothingEnabled ??
                            DEFAULT_RENDER_STYLE.imageSmoothingEnabled;
                        this.#applyStyle(ctx, activeStyle);
                    }

                    break;
                }
                case RenderCommandType.SET_OPACITY: {
                    opacity = data[dataPointer++];
                    ctx.globalAlpha = opacity;

                    break;
                }
                default: {
                    const x = data[dataPointer++];
                    const y = data[dataPointer++];
                    const w = data[dataPointer++];
                    const h = data[dataPointer++];
                    const rx = data[dataPointer++];
                    const ry = data[dataPointer++];
                    const gx = data[dataPointer++];
                    const gy = data[dataPointer++];

                    switch (commandType) {
                        case RenderCommandType.DRAW_RECT:
                            this.#drawRect(x, y, w, h, rx, ry, gx, gy, ctx, activeStyle);
                            break;
                        case RenderCommandType.DRAW_ELLIPSE:
                            this.#drawEllipse(x, y, w, h, rx, ry, gx, gy, ctx, activeStyle);
                            break;
                        case RenderCommandType.DRAW_LINE:
                            this.#drawLine(x, y, w, h, rx, ry, gx, gy, ctx, activeStyle);
                            break;
                        case RenderCommandType.DRAW_IMAGE:
                            this.#drawImage(x, y, w, h, data[dataPointer++], ctx);
                            break;
                        default:
                            break;
                    }

                    break;
                }
            }
        }
    }

    #applyStyle = (ctx: CanvasRenderingContext2D, style: CanvasStyle) => {
        for (const key in style) {
            const styleKey = key as keyof CanvasStyle;
            const value = style[styleKey];
            if (value !== undefined && this.#canvasStateCache[styleKey] !== value) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ctx as any)[key] = value;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this.#canvasStateCache as any)[styleKey] = value;
            }
        }
    };

    #drawRect(
        x: number,
        y: number,
        w: number,
        h: number,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
        ctx: CanvasRenderingContext2D,
        activeStyle: RenderStyle,
    ) {
        // Fill first so stroke remains visible on top
        if (activeStyle.fillStyle && activeStyle.fillStyle !== TRANSPARENT_STYLE_COLOR) {
            for (let i = 0; i < rx; i++) {
                for (let j = 0; j < ry; j++) {
                    ctx.fillRect(x + i * gx, y + j * gy, w, h);
                }
            }
        }

        // Draw strokes without scaling line width with transform
        if (
            activeStyle.strokeStyle &&
            activeStyle.strokeStyle !== TRANSPARENT_STYLE_COLOR &&
            activeStyle.lineWidth &&
            activeStyle.lineWidth > 0
        ) {
            const currentScale = this.#transformScaleStack[this.#transformScaleStack.length - 1];
            const adjusted = activeStyle.lineWidth / currentScale;
            const prevWidth = ctx.lineWidth;
            ctx.lineWidth = adjusted > 0 ? adjusted : 1;

            for (let i = 0; i < rx; i++) {
                for (let j = 0; j < ry; j++) {
                    ctx.strokeRect(x + i * gx, y + j * gy, w, h);
                }
            }

            ctx.lineWidth = prevWidth;
        }
    }

    #drawEllipse(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
        ctx: CanvasRenderingContext2D,
        activeStyle: RenderStyle,
    ) {
        const currentScale = this.#transformScaleStack[this.#transformScaleStack.length - 1];
        const radiusX = (x2 - x1) / 2;
        const radiusY = (y2 - y1) / 2;
        const shouldFill =
            activeStyle.fillStyle && activeStyle.fillStyle !== TRANSPARENT_STYLE_COLOR;
        const shouldStroke =
            activeStyle.strokeStyle && activeStyle.strokeStyle !== TRANSPARENT_STYLE_COLOR;

        let prevWidth = 1;
        if (shouldStroke) {
            let adjustedWidth = 1;
            const lineWidth =
                activeStyle.lineWidth && activeStyle.lineWidth > 0 ? activeStyle.lineWidth : 1;
            adjustedWidth = lineWidth / currentScale;
            adjustedWidth = adjustedWidth > 0 ? adjustedWidth : 1;
            prevWidth = ctx.lineWidth;
            ctx.lineWidth = adjustedWidth;
        }

        for (let i = 0; i < rx; i++) {
            for (let j = 0; j < ry; j++) {
                ctx.beginPath();
                ctx.ellipse(x1 + i * gx, y1 + j * gy, radiusX, radiusY, 0, 0, 2 * Math.PI);
                if (shouldFill) {
                    ctx.fill();
                }
                if (shouldStroke) {
                    ctx.stroke();
                }
                ctx.closePath();
            }
        }

        if (shouldStroke) {
            ctx.lineWidth = prevWidth;
        }
    }

    #drawLine(
        x: number,
        y: number,
        w: number,
        h: number,
        rx: number,
        ry: number,
        gx: number,
        gy: number,
        ctx: CanvasRenderingContext2D,
        activeStyle: RenderStyle,
    ) {
        const strokeColor = activeStyle.strokeStyle
            ? activeStyle.strokeStyle
            : activeStyle.fillStyle;
        if (strokeColor !== undefined && this.#canvasStateCache.strokeStyle !== strokeColor) {
            ctx.strokeStyle = strokeColor;
            this.#canvasStateCache.strokeStyle = strokeColor;
        }

        const lineWidth =
            activeStyle.lineWidth && activeStyle.lineWidth > 0 ? activeStyle.lineWidth : 1;
        if (this.#canvasStateCache.lineWidth !== lineWidth) {
            ctx.lineWidth = lineWidth;
            this.#canvasStateCache.lineWidth = lineWidth;
        }

        ctx.beginPath();
        for (let i = 0; i < rx; i++) {
            for (let j = 0; j < ry; j++) {
                ctx.moveTo(x + i * gx, y + j * gy);
                ctx.lineTo(w + i * gx, h + j * gy);
            }
        }
        ctx.stroke();
        ctx.closePath();
    }

    #drawImage(
        x: number,
        y: number,
        w: number,
        h: number,
        imageID: number,
        ctx: CanvasRenderingContext2D,
    ) {
        const image = this.#imageCache.get(imageID);
        if (!image) {
            return;
        }

        ctx.drawImage(image.image, x, y, w, h);
    }
}
