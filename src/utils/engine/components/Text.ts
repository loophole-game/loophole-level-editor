import { C_Drawable, type C_DrawableOptions } from '.';
import { Vector } from '../math';
import type { RenderCommandStream } from '../systems/render/command';
import type { TwoAxisAlignment } from '../types';

const MONOSPACE_WIDTH_RATIO = 0.6;
const MONOSPACE_HEIGHT_RATIO = 1.2;

type FontFamily = 'sans-serif' | 'serif' | 'monospace';

type Trim = 'none' | 'all' | 'ends';

interface TextLine {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface C_TextOptions extends C_DrawableOptions {
    text?: string;
    fontSize?: number;
    fontFamily?: FontFamily;
    lineGap?: number;
    textAlign?: TwoAxisAlignment;
    trim?: Trim;
}

export class C_Text extends C_Drawable {
    #text: string;
    #fontSize: number;
    #fontFamily: FontFamily;
    #lineGap: number;
    #textAlign: TwoAxisAlignment;
    #trim: Trim;

    #textDirty: boolean = true;
    #textLines: TextLine[] = [];
    #textPosition: Vector = new Vector(0);
    #textSize: Vector = new Vector(0);

    constructor(options: C_TextOptions) {
        const { style, ...rest } = options;
        super({
            style: {
                fillStyle: 'white',
                ...style,
            },
            ...rest,
        });

        const { text, fontSize, fontFamily, lineGap, textAlign, trim } = options;
        this.#text = text ?? '';
        this.#fontSize = fontSize ?? 12;
        this.#fontFamily = fontFamily ?? 'monospace';
        this.#lineGap = lineGap ?? Math.round(this.#fontSize * 0.25);
        this.#textAlign = textAlign ?? 'top-left';
        this.#trim = trim ?? 'all';

        this.#computeFont();
    }

    get text(): string {
        return this.#text;
    }

    set text(text: string) {
        if (text != this.#text) {
            this.#text = text;
            this.#textDirty = true;
        }
    }

    get fontSize(): number {
        return this.#fontSize;
    }

    set fontSize(fontSize: number) {
        if (fontSize != this.#fontSize) {
            this.#fontSize = fontSize;
            this.#computeFont();
            this.#textDirty = true;
        }
    }

    get fontFamily(): FontFamily {
        return this.#fontFamily;
    }

    set fontFamily(fontFamily: FontFamily) {
        if (fontFamily != this.#fontFamily) {
            this.#fontFamily = fontFamily;
            this.#computeFont();
            this.#textDirty = true;
        }
    }

    get lineGap(): number {
        return this.#lineGap;
    }

    set lineGap(lineGap: number) {
        if (lineGap != this.#lineGap) {
            this.#lineGap = lineGap;
            this.#textDirty = true;
        }
    }

    get textAlign(): TwoAxisAlignment {
        return this.#textAlign;
    }

    set textAlign(textAlign: TwoAxisAlignment) {
        if (textAlign != this.#textAlign) {
            this.#textAlign = textAlign;
            this.#textDirty = true;
        }
    }

    get trim(): Trim {
        return this.#trim;
    }

    set trim(trim: Trim) {
        if (trim != this.#trim) {
            this.#trim = trim;
            this.#textDirty = true;
        }
    }

    override queueRenderCommands(stream: RenderCommandStream): boolean {
        if (!this.#text || !super.queueRenderCommands(stream)) {
            return false;
        }

        if (this.#textDirty) {
            this.#computeTextLines();
            this.#textDirty = false;
        }

        for (const line of this.#textLines) {
            stream.drawText(line.text, line.x, line.y);
        }

        return true;
    }

    override _computeBoundingBox(): void {
        if (this.#textDirty) {
            this.#computeTextLines();
            this.#textDirty = false;
        }

        this._boundingBox = {
            x1: this.#textPosition.x,
            x2: this.#textPosition.x + this.#textSize.x,
            y1: this.#textPosition.y,
            y2: this.#textPosition.y + this.#textSize.y,
        };
    }

    #computeTextLines() {
        this.#textLines = [];
        this.#textSize.set(0);
        this.#textPosition.set(0);

        const fontSize = this.#fontSize;
        const textLines = this.#textLines;
        const lines = this.#text.split('\n');

        // Calculate individual line dimensions
        let overallWidth = 0,
            overallHeight = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const shouldTrim =
                this.#trim === 'all' ||
                (this.#trim === 'ends' && (i === 0 || i === lines.length - 1));
            const text = shouldTrim ? line.trim() : line;
            if (shouldTrim && !text) continue;

            const width = fontSize * MONOSPACE_WIDTH_RATIO * text.length;
            if (width > overallWidth) {
                overallWidth = width;
            }

            const height = fontSize * MONOSPACE_HEIGHT_RATIO;
            textLines.push({ text, x: this._origin.x, y: overallHeight, width, height });

            overallHeight += height;
            if (i < lines.length - 1) {
                overallHeight += this.#lineGap;
            }
        }

        overallWidth = Math.ceil(overallWidth);
        overallHeight = Math.ceil(overallHeight);

        // Horizontal alignment
        switch (this.#textAlign) {
            case 'top-left':
            case 'left':
            case 'bottom-left':
                this.#textPosition.x -= overallWidth;
                for (const line of textLines) {
                    line.x -= line.width;
                }
                break;
            case 'top-center':
            case 'center':
            case 'bottom-center':
                this.#textPosition.x -= overallWidth / 2;
                for (const line of textLines) {
                    line.x -= line.width / 2;
                }
                break;
            default:
                break;
        }

        // Vertical alignment
        switch (this.#textAlign) {
            case 'top-left':
            case 'top-center':
            case 'top-right':
                this.#textPosition.y -= overallHeight;
                for (const line of textLines) {
                    line.y -= overallHeight;
                }
                break;
            case 'left':
            case 'center':
            case 'right':
                this.#textPosition.y -= overallHeight / 2;
                for (const line of textLines) {
                    line.y -= overallHeight / 2;
                }
                break;
        }

        this.#textSize.set({ x: overallWidth, y: overallHeight });

        this._markBoundingBoxDirty();
    }

    #computeFont() {
        this.style.font = `${this.#fontSize}px ${this.#fontFamily}`;
    }
}
