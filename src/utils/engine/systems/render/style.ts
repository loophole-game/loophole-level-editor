export const TRANSPARENT_STYLE_COLOR = 'rgba(0, 0, 0, 0)';

export interface RenderStyle {
    fillStyle?: string | CanvasGradient | CanvasPattern;
    strokeStyle?: string | CanvasGradient | CanvasPattern;
    lineWidth?: number;
    lineJoin?: CanvasLineJoin;
    lineCap?: CanvasLineCap;
    imageSmoothingEnabled?: boolean;
    font?: string;
    textBaseline?: CanvasTextBaseline;
}

export const DEFAULT_RENDER_STYLE: Required<RenderStyle> = {
    fillStyle: TRANSPARENT_STYLE_COLOR,
    strokeStyle: TRANSPARENT_STYLE_COLOR,
    lineWidth: 0,
    lineJoin: 'miter',
    lineCap: 'butt',
    imageSmoothingEnabled: true,
    font: '10px sans-serif',
    textBaseline: 'top',
};
