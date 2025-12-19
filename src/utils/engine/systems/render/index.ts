import { System } from '..';
import type { Entity } from '../../entities';
import { HashFactory } from '../../hashFactory';
import type { Camera } from '../../types';
import { zoomToScale } from '../../utils';
import { RenderCommandStream, RenderCommandType } from './command';
import { DEFAULT_RENDER_STYLE, TRANSPARENT_STYLE_COLOR, type RenderStyle } from './style';

const HASH_STYLE_KEYS: (keyof Required<RenderStyle>)[] = [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'lineJoin',
    'lineCap',
    'globalAlpha',
    'imageSmoothingEnabled',
];

export class RenderSystem extends System {
    #stream: RenderCommandStream | null = null;

    #hashedMaterials: HashFactory<RenderStyle> = new HashFactory<RenderStyle>(
        (style: RenderStyle) => {
            return HASH_STYLE_KEYS.reduce((prev, key) => {
                const styleKey = key as keyof RenderStyle;
                const value = style[styleKey] ?? DEFAULT_RENDER_STYLE[styleKey];
                return `${prev}${prev ? ',' : ''}${value}`;
            }, '');
        },
    );
    #hashedImages: HashFactory<string> = new HashFactory<string>((image) => image);

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

        rootEntity.queueRenderCommands(this.#stream, camera);

        this._engine.trace(`renderCommands(${this.#stream.length})`, () => {
            const activeStyle = { ...DEFAULT_RENDER_STYLE };
            this.#applyStyle(ctx, activeStyle);

            const commands = this.#stream!.commands;
            const commandsLength = this.#stream!.commandsLength;
            for (let i = 0; i < commandsLength; i++) {
                const commandType = commands[i] as RenderCommandType;
                switch (commandType) {
                    case RenderCommandType.PUSH_TRANSFORM:
                        ctx.save();
                        ctx.transform(
                            commands[i + 1],
                            commands[i + 2],
                            commands[i + 3],
                            commands[i + 4],
                            commands[i + 5],
                            commands[i + 6],
                        );
                        i += 6;

                        break;
                    case RenderCommandType.POP_TRANSFORM:
                        ctx.restore();

                        break;
                    case RenderCommandType.SET_MATERIAL: {
                        const styleID = commands[i + 1];
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
                            activeStyle.lineCap =
                                style.value.lineCap ?? DEFAULT_RENDER_STYLE.lineCap;
                            activeStyle.globalAlpha =
                                style.value.globalAlpha ?? DEFAULT_RENDER_STYLE.globalAlpha;
                            activeStyle.imageSmoothingEnabled =
                                style.value.imageSmoothingEnabled ??
                                DEFAULT_RENDER_STYLE.imageSmoothingEnabled;
                            this.#applyStyle(ctx, activeStyle);
                        }
                        i += 1;

                        break;
                    }
                    default: {
                        const x = commands[i + 1];
                        const y = commands[i + 2];
                        const w = commands[i + 3];
                        const h = commands[i + 4];
                        const rx = commands[i + 5];
                        const ry = commands[i + 6];
                        const gx = commands[i + 7];
                        const gy = commands[i + 8];
                        i += 8;

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
                                this.#drawImage(x, y, w, h, commands[i + 1], ctx);
                                i += 1;
                                break;
                            default:
                                break;
                        }

                        break;
                    }
                }
            }
        });
    }

    #applyStyle = (ctx: CanvasRenderingContext2D, style: RenderStyle) => {
        // Apply all properties without comparison since the material system
        // already deduplicates via string keys, and canvas normalizes values
        // (e.g., 'transparent' → 'rgba(0,0,0,0)') making comparisons unreliable
        Object.entries(style).forEach(([_key, value]) => {
            const key = _key as keyof CanvasRenderingContext2D;
            if (value !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ctx as any)[key] = value;
            }
        });
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
            const m = ctx.getTransform();
            const scaleX = Math.hypot(m.a, m.b);
            const scaleY = Math.hypot(m.c, m.d);
            const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
            const adjusted = activeStyle.lineWidth / denom;
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
        for (let i = 0; i < rx; i++) {
            for (let j = 0; j < ry; j++) {
                ctx.beginPath();
                ctx.ellipse(
                    x1 + i * gx,
                    y1 + j * gy,
                    (x2 - x1) / 2,
                    (y2 - y1) / 2,
                    0,
                    0,
                    2 * Math.PI,
                );
                if (activeStyle.fillStyle && activeStyle.fillStyle !== TRANSPARENT_STYLE_COLOR) {
                    ctx.fill();
                }
                if (
                    activeStyle.strokeStyle &&
                    activeStyle.strokeStyle !== TRANSPARENT_STYLE_COLOR
                ) {
                    const m = ctx.getTransform();
                    const scaleX = Math.hypot(m.a, m.b);
                    const scaleY = Math.hypot(m.c, m.d);
                    const denom = Math.max(scaleX || 1, scaleY || 1) || 1;
                    const adjusted =
                        (activeStyle.lineWidth && activeStyle.lineWidth > 0
                            ? activeStyle.lineWidth
                            : 1) / denom;
                    const prevWidth = ctx.lineWidth;
                    ctx.lineWidth = adjusted > 0 ? adjusted : 1;
                    ctx.stroke();
                    ctx.lineWidth = prevWidth;
                }
                ctx.closePath();
            }
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
        if (strokeColor !== undefined) {
            ctx.strokeStyle = strokeColor;
        }

        ctx.lineWidth =
            activeStyle.lineWidth && activeStyle.lineWidth > 0 ? activeStyle.lineWidth : 1;

        for (let i = 0; i < rx; i++) {
            for (let j = 0; j < ry; j++) {
                ctx.beginPath();
                ctx.moveTo(x + i * gx, y + j * gy);
                ctx.lineTo(w + i * gx, h + j * gy);
                ctx.stroke();
                ctx.closePath();
            }
        }
    }

    #drawImage(
        x: number,
        y: number,
        w: number,
        h: number,
        imageID: number,
        ctx: CanvasRenderingContext2D,
    ) {
        const hashedImage = this.#hashedImages.idToItem(imageID);
        if (hashedImage === null) {
            return;
        }

        const image = this._engine.getImage(hashedImage.value);
        if (!image) {
            return;
        }

        ctx.drawImage(image.image, x, y, w, h);
    }
}
