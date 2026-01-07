import { C_Drawable, type C_DrawableOptions } from '.';
import { Vector } from '../math';
import type { RenderCommandStream } from '../systems/render/command';
import type { TwoAxisAlignment } from '../types';

const MONOSPACE_WIDTH_RATIO = 0.6;
const MONOSPACE_HEIGHT_RATIO = 1.2;

const TagKeys = {
    COLOR: 'color',
    SIZE: 'size',
    FAMILY: 'family',
    OPACITY: 'opacity',
    BOLD: 'bold',
    ITALIC: 'italic',
} as const;
type TagKeys = (typeof TagKeys)[keyof typeof TagKeys];

type FontFamily = 'sans-serif' | 'serif' | 'monospace';

type Trim = 'none' | 'all' | 'ends';

type TextDrawAction =
    | {
          type: 'setStyle';
          fontSize: number;
          fontFamily: FontFamily;
          color: string;
          bold: boolean;
          italic: boolean;
      }
    | {
          type: 'setOpacity';
          opacity: number;
      }
    | {
          type: 'drawText';
          text: string;
          x: number;
          y: number;
      };

interface TextStyle {
    fontSize?: number;
    fontFamily?: FontFamily;
    color?: string;
    opacity?: number;
    bold?: boolean;
    italic?: boolean;
}

type TextNode =
    | {
          type: 'text';
          text: string;
      }
    | {
          type: 'style';
          style: Required<TextStyle>;
      }
    | {
          type: 'newline';
      };

interface C_TextOptions extends C_DrawableOptions {
    text?: string;
    fontSize?: number;
    fontFamily?: FontFamily;
    lineGap?: number;
    textAlign?: TwoAxisAlignment;
    trim?: Trim;
    italic?: boolean;
    bold?: boolean;
    opacity?: number;
    startTagDelim?: string;
    endTagDelim?: string;
}

export class C_Text extends C_Drawable {
    #text: string;
    #fontSize: number;
    #fontFamily: FontFamily;
    #lineGap: number;
    #textAlign: TwoAxisAlignment;
    #trim: Trim;
    #startTagDelim: string;
    #endTagDelim: string;
    #italic: boolean;
    #bold: boolean;
    #opacity: number;

    #textDirty: boolean = true;
    #drawActions: TextDrawAction[] = [];
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

        this.#text = options.text ?? '';
        this.#fontSize = options.fontSize ?? 12;
        this.#fontFamily = options.fontFamily ?? 'monospace';
        this.#lineGap = options.lineGap ?? Math.round(this.#fontSize * 0.25);
        this.#textAlign = options.textAlign ?? 'top-left';
        this.#trim = options.trim ?? 'all';
        this.#startTagDelim = options.startTagDelim ?? '<';
        this.#endTagDelim = options.endTagDelim ?? '>';
        this.#italic = options.italic ?? false;
        this.#bold = options.bold ?? false;
        this.#opacity = options.opacity ?? 1;
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
            this.#textDirty = true;
        }
    }

    get fontFamily(): FontFamily {
        return this.#fontFamily;
    }

    set fontFamily(fontFamily: FontFamily) {
        if (fontFamily != this.#fontFamily) {
            this.#fontFamily = fontFamily;
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

    get italic(): boolean {
        return this.#italic;
    }

    set italic(italic: boolean) {
        if (italic != this.#italic) {
            this.#italic = italic;
            this.#textDirty = true;
        }
    }

    get bold(): boolean {
        return this.#bold;
    }

    set bold(bold: boolean) {
        if (bold != this.#bold) {
            this.#bold = bold;
            this.#textDirty = true;
        }
    }

    get opacity(): number {
        return this.#opacity;
    }

    set opacity(opacity: number) {
        if (opacity != this.#opacity) {
            this.#opacity = opacity;
            this.#textDirty = true;
        }
    }

    get startTagDelim(): string {
        return this.#startTagDelim;
    }

    set startTagDelim(startTagDelim: string) {
        if (startTagDelim != this.#startTagDelim) {
            this.#startTagDelim = startTagDelim;
            this.#textDirty = true;
        }
    }

    get endTagDelim(): string {
        return this.#endTagDelim;
    }

    set endTagDelim(endTagDelim: string) {
        if (endTagDelim != this.#endTagDelim) {
            this.#endTagDelim = endTagDelim;
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

        for (const action of this.#drawActions) {
            if (action.type === 'setStyle') {
                const fontStyle = action.italic ? 'italic ' : '';
                const fontWeight = action.bold ? 'bold ' : '';
                stream.setStyle({
                    fillStyle: action.color,
                    font: `${fontStyle}${fontWeight}${action.fontSize}px ${action.fontFamily}`,
                });
            } else if (action.type === 'setOpacity') {
                stream.setOpacity(action.opacity);
            } else {
                stream.drawText(action.text, action.x, action.y);
            }
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
        this.#drawActions = [];
        this.#textSize.set(0);
        this.#textPosition.set(0);

        const nodes = this.#parseTextLines(this.#text);

        // First pass: organize nodes into lines and calculate dimensions
        interface Line {
            nodes: TextNode[];
            width: number;
            height: number;
            maxFontSize: number;
        }

        const lines: Line[] = [];
        let currentLine: TextNode[] = [];
        let currentLineWidth = 0;
        let maxFontSizeInLine = this.#fontSize;
        let currentStyle: Required<TextStyle> = {
            fontSize: this.#fontSize,
            fontFamily: this.#fontFamily,
            color: typeof this.style.fillStyle === 'string' ? this.style.fillStyle : 'white',
            opacity: 1,
            bold: this.#bold,
            italic: this.#italic,
        };

        for (const node of nodes) {
            if (node.type === 'style') {
                currentStyle = node.style;
                maxFontSizeInLine = Math.max(maxFontSizeInLine, currentStyle.fontSize);
                currentLine.push(node);
            } else if (node.type === 'newline') {
                const height = maxFontSizeInLine * MONOSPACE_HEIGHT_RATIO;
                lines.push({
                    nodes: currentLine,
                    width: currentLineWidth,
                    height,
                    maxFontSize: maxFontSizeInLine,
                });
                currentLine = [];
                currentLineWidth = 0;
                maxFontSizeInLine = this.#fontSize;
            } else if (node.type === 'text') {
                const textWidth = currentStyle.fontSize * MONOSPACE_WIDTH_RATIO * node.text.length;
                currentLineWidth += textWidth;
                currentLine.push(node);
            }
        }

        // Add the last line if it has content
        if (currentLine.length > 0) {
            const height = maxFontSizeInLine * MONOSPACE_HEIGHT_RATIO;
            lines.push({
                nodes: currentLine,
                width: currentLineWidth,
                height,
                maxFontSize: maxFontSizeInLine,
            });
        }

        // Apply trimming
        const trimmedLines: Line[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const shouldTrim =
                this.#trim === 'all' ||
                (this.#trim === 'ends' && (i === 0 || i === lines.length - 1));

            if (shouldTrim) {
                // Trim whitespace from text nodes
                const trimmedNodes: TextNode[] = [];
                let hasContent = false;

                for (const node of line.nodes) {
                    if (node.type === 'text') {
                        const trimmed =
                            i === 0 && i === lines.length - 1
                                ? node.text.trim()
                                : i === 0
                                  ? node.text.trimStart()
                                  : i === lines.length - 1
                                    ? node.text.trimEnd()
                                    : node.text;
                        if (trimmed) {
                            trimmedNodes.push({ type: 'text', text: trimmed });
                            hasContent = true;
                        }
                    } else {
                        trimmedNodes.push(node);
                    }
                }

                if (hasContent || trimmedNodes.some((n) => n.type === 'style')) {
                    // Recalculate width
                    let width = 0;
                    let currentFontSize = this.#fontSize;
                    for (const node of trimmedNodes) {
                        if (node.type === 'style') {
                            currentFontSize = node.style.fontSize;
                        } else if (node.type === 'text') {
                            width += currentFontSize * MONOSPACE_WIDTH_RATIO * node.text.length;
                        }
                    }
                    trimmedLines.push({
                        nodes: trimmedNodes,
                        width,
                        height: line.height,
                        maxFontSize: line.maxFontSize,
                    });
                }
            } else {
                trimmedLines.push(line);
            }
        }

        // Calculate overall dimensions
        const overallWidth = Math.ceil(Math.max(...trimmedLines.map((l) => l.width), 0));
        let overallHeight = 0;
        for (let i = 0; i < trimmedLines.length; i++) {
            overallHeight += trimmedLines[i].height;
            if (i < trimmedLines.length - 1) {
                overallHeight += this.#lineGap;
            }
        }
        overallHeight = Math.ceil(overallHeight);

        // Calculate alignment offsets
        const baseX = this._origin.x;
        const baseY = this._origin.y;

        // Horizontal alignment
        switch (this.#textAlign) {
            case 'top-left':
            case 'left':
            case 'bottom-left':
                this.#textPosition.x = baseX - overallWidth;
                break;
            case 'top-center':
            case 'center':
            case 'bottom-center':
                this.#textPosition.x = baseX - overallWidth / 2;
                break;
            case 'top-right':
            case 'right':
            case 'bottom-right':
                this.#textPosition.x = baseX;
                break;
        }

        // Vertical alignment
        switch (this.#textAlign) {
            case 'top-left':
            case 'top-center':
            case 'top-right':
                this.#textPosition.y = baseY - overallHeight;
                break;
            case 'left':
            case 'center':
            case 'right':
                this.#textPosition.y = baseY - overallHeight / 2;
                break;
            case 'bottom-left':
            case 'bottom-center':
            case 'bottom-right':
                this.#textPosition.y = baseY;
                break;
        }

        // Second pass: generate draw actions with proper positioning
        let currentY = this.#textPosition.y;

        // Track previous style to avoid redundant actions
        let lastFontSize = this.#fontSize;
        let lastFontFamily = this.#fontFamily;
        let lastColor = typeof this.style.fillStyle === 'string' ? this.style.fillStyle : 'white';
        let lastOpacity = 1;
        let lastBold = false;
        let lastItalic = false;

        for (const line of trimmedLines) {
            let currentX = this.#textPosition.x;

            // Apply per-line horizontal alignment
            switch (this.#textAlign) {
                case 'top-left':
                case 'left':
                case 'bottom-left':
                    currentX = this.#textPosition.x + (overallWidth - line.width);
                    break;
                case 'top-center':
                case 'center':
                case 'bottom-center':
                    currentX = this.#textPosition.x + (overallWidth - line.width) / 2;
                    break;
                case 'top-right':
                case 'right':
                case 'bottom-right':
                    currentX = this.#textPosition.x;
                    break;
            }

            let currentFontSize = this.#fontSize;

            for (const node of line.nodes) {
                if (node.type === 'style') {
                    currentFontSize = node.style.fontSize;

                    // Only emit setStyle if font/color changed
                    if (
                        node.style.fontSize !== lastFontSize ||
                        node.style.fontFamily !== lastFontFamily ||
                        node.style.color !== lastColor ||
                        node.style.bold !== lastBold ||
                        node.style.italic !== lastItalic
                    ) {
                        this.#drawActions.push({
                            type: 'setStyle',
                            fontSize: node.style.fontSize,
                            fontFamily: node.style.fontFamily,
                            color: node.style.color,
                            bold: node.style.bold,
                            italic: node.style.italic,
                        });
                        lastFontSize = node.style.fontSize;
                        lastFontFamily = node.style.fontFamily;
                        lastColor = node.style.color;
                        lastBold = node.style.bold;
                        lastItalic = node.style.italic;
                    }

                    // Only emit setOpacity if opacity changed
                    if (node.style.opacity !== lastOpacity) {
                        this.#drawActions.push({
                            type: 'setOpacity',
                            opacity: node.style.opacity,
                        });
                        lastOpacity = node.style.opacity;
                    }
                } else if (node.type === 'text') {
                    const currentHeight = currentFontSize * MONOSPACE_HEIGHT_RATIO;
                    const verticalOffset = (line.height - currentHeight) / 2;

                    this.#drawActions.push({
                        type: 'drawText',
                        text: node.text,
                        x: currentX,
                        y: currentY + verticalOffset,
                    });
                    currentX += currentFontSize * MONOSPACE_WIDTH_RATIO * node.text.length;
                }
            }

            currentY += line.height + this.#lineGap;
        }

        while (
            this.#drawActions.length > 0 &&
            this.#drawActions[this.#drawActions.length - 1].type !== 'drawText'
        ) {
            this.#drawActions.pop();
        }

        this.#textSize.set({ x: overallWidth, y: overallHeight });
        this._markBoundingBoxDirty();
    }

    #parseTextLines(text: string): TextNode[] {
        // Initialize default style
        const defaultStyle: Required<TextStyle> = {
            fontSize: this.#fontSize,
            fontFamily: this.#fontFamily,
            color: typeof this.style.fillStyle === 'string' ? this.style.fillStyle : 'white',
            opacity: 1,
            bold: false,
            italic: false,
        };

        const currentStyle: Required<TextStyle> = { ...defaultStyle };

        const nodes: TextNode[] = [{ type: 'style', style: { ...currentStyle } }];

        const len = text.length;
        let i = 0;
        let textStart = 0;
        let prevNode: TextNode | null = null;

        const startDelimLen = this.#startTagDelim.length;
        const endDelimLen = this.#endTagDelim.length;

        while (i < len) {
            const char = text[i];

            // Check for newline
            if (char === '\n') {
                if (i > textStart) {
                    prevNode = { type: 'text', text: text.slice(textStart, i) };
                    nodes.push(prevNode);
                }

                prevNode = { type: 'newline' };
                nodes.push(prevNode);

                i++;
                textStart = i;

                continue;
            }

            // Check for tag start
            if (text.slice(i, i + startDelimLen) === this.#startTagDelim) {
                if (i > textStart) {
                    prevNode = { type: 'text', text: text.slice(textStart, i) };
                    nodes.push(prevNode);
                }

                let tagEnd = i + startDelimLen;
                while (
                    tagEnd < len &&
                    text.slice(tagEnd, tagEnd + endDelimLen) !== this.#endTagDelim
                ) {
                    tagEnd++;
                }

                if (tagEnd < len) {
                    const tagContent = text.slice(i + startDelimLen, tagEnd).trim();

                    if (tagContent.startsWith('/')) {
                        // Reset to default
                        const key = tagContent.slice(1).trim();
                        let styleChanged = false;
                        switch (key) {
                            case TagKeys.COLOR:
                                if (currentStyle.color !== defaultStyle.color) {
                                    currentStyle.color = defaultStyle.color;
                                    styleChanged = true;
                                }
                                break;
                            case TagKeys.SIZE:
                                if (currentStyle.fontSize !== defaultStyle.fontSize) {
                                    currentStyle.fontSize = defaultStyle.fontSize;
                                    styleChanged = true;
                                }
                                break;
                            case TagKeys.FAMILY:
                                if (currentStyle.fontFamily !== defaultStyle.fontFamily) {
                                    currentStyle.fontFamily = defaultStyle.fontFamily;
                                    styleChanged = true;
                                }
                                break;
                            case TagKeys.OPACITY:
                                if (currentStyle.opacity !== defaultStyle.opacity) {
                                    currentStyle.opacity = defaultStyle.opacity;
                                    styleChanged = true;
                                }
                                break;
                            case TagKeys.BOLD:
                                if (currentStyle.bold !== defaultStyle.bold) {
                                    currentStyle.bold = defaultStyle.bold;
                                    styleChanged = true;
                                }
                                break;
                            case TagKeys.ITALIC:
                                if (currentStyle.italic !== defaultStyle.italic) {
                                    currentStyle.italic = defaultStyle.italic;
                                    styleChanged = true;
                                }
                                break;
                        }

                        if (styleChanged) {
                            this.#changeStyleNode(currentStyle, prevNode, nodes);
                        }
                    } else {
                        const attributes = tagContent.split(/\s+/);
                        let styleChanged = false;

                        for (const attr of attributes) {
                            const equalPos = attr.indexOf('=');

                            if (equalPos !== -1) {
                                // key=value pairs
                                const key = attr.slice(0, equalPos).trim();
                                const value = attr.slice(equalPos + 1).trim();

                                if (key && value) {
                                    switch (key) {
                                        case TagKeys.COLOR:
                                            if (currentStyle.color !== value) {
                                                currentStyle.color = value;
                                                styleChanged = true;
                                            }
                                            break;
                                        case TagKeys.SIZE: {
                                            const newSize = Number(value) || this.#fontSize;
                                            if (currentStyle.fontSize !== newSize) {
                                                currentStyle.fontSize = newSize;
                                                styleChanged = true;
                                            }
                                            break;
                                        }
                                        case TagKeys.FAMILY:
                                            if (
                                                currentStyle.fontFamily !== value &&
                                                (value === 'sans-serif' ||
                                                    value === 'serif' ||
                                                    value === 'monospace')
                                            ) {
                                                currentStyle.fontFamily = value;
                                                styleChanged = true;
                                            }
                                            break;
                                        case TagKeys.OPACITY: {
                                            const newOpacity = Number(value) || 1;
                                            if (currentStyle.opacity !== newOpacity) {
                                                currentStyle.opacity = newOpacity;
                                                styleChanged = true;
                                            }
                                            break;
                                        }
                                        case TagKeys.BOLD: {
                                            const newBold = value === 'true' || value === '1';
                                            if (currentStyle.bold !== newBold) {
                                                currentStyle.bold = newBold;
                                                styleChanged = true;
                                            }
                                            break;
                                        }
                                        case TagKeys.ITALIC: {
                                            const newItalic = value === 'true' || value === '1';
                                            if (currentStyle.italic !== newItalic) {
                                                currentStyle.italic = newItalic;
                                                styleChanged = true;
                                            }
                                            break;
                                        }
                                    }
                                }
                            } else {
                                // Shorthand for booleans
                                const key = attr.trim();
                                if (key) {
                                    styleChanged = true;
                                    switch (key) {
                                        case TagKeys.BOLD:
                                            currentStyle.bold = true;
                                            break;
                                        case TagKeys.ITALIC:
                                            currentStyle.italic = true;
                                            break;
                                    }
                                }
                            }
                        }

                        // Add style node if any attributes were processed
                        if (styleChanged) {
                            this.#changeStyleNode(currentStyle, prevNode, nodes);
                        }
                    }

                    i = tagEnd + endDelimLen;
                    textStart = i;
                } else {
                    // Malformed tag
                    this._engine.warn(`Text '${this.name} has malformed tag at index ${i}`);
                    i++;
                }
                continue;
            }

            i++;
        }

        if (i > textStart) {
            prevNode = { type: 'text', text: text.slice(textStart, i) };
            nodes.push(prevNode);
        }

        return nodes;
    }

    #changeStyleNode(
        currentStyle: Required<TextStyle>,
        prevNode: TextNode | null,
        nodes: TextNode[],
    ) {
        if (prevNode?.type === 'style') {
            prevNode.style = { ...currentStyle };
        } else {
            prevNode = { type: 'style', style: { ...currentStyle } };
            nodes.push(prevNode);
        }
    }
}
