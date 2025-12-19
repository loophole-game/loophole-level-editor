import type { BoundingBox, Camera } from './types';
import { type IVector } from './math';

export const lerp = (from: number, to: number, t: number): number => {
    return from + (to - from) * t;
};

export const isMac = navigator.platform.toUpperCase().includes('MAC');

export const DEFAULT_CAMERA_OPTIONS: Camera = {
    zoom: 0,
    rotation: 0,
    position: { x: 0, y: 0 },
    boundingBox: { x1: 0, x2: 0, y1: 0, y2: 0 },
    dirty: false,
};

export const zoomToScale = (zoom: number): number => {
    return Math.pow(2, zoom);
};

export const scaleToZoom = (scale: number): number => {
    return Math.log2(scale);
};

export const calculateRectangleBoundingBox = (
    position: IVector<number>,
    size: IVector<number>,
    rotation: number,
    origin: IVector<number> = { x: 0, y: 0 },
): BoundingBox => {
    // Convert rotation from degrees to radians
    const theta = (rotation * Math.PI) / 180;

    // Rectangle corners relative to the origin
    const corners = [
        { x: -origin.x, y: -origin.y }, // Top-left
        { x: size.x - origin.x, y: -origin.y }, // Top-right
        { x: size.x - origin.x, y: size.y - origin.y }, // Bottom-right
        { x: -origin.x, y: size.y - origin.y }, // Bottom-left
    ];

    // Rotate and translate corners
    const rotated = corners.map((pt) => {
        const xRot = pt.x * Math.cos(theta) - pt.y * Math.sin(theta);
        const yRot = pt.x * Math.sin(theta) + pt.y * Math.cos(theta);
        return {
            x: xRot + position.x,
            y: yRot + position.y,
        };
    });

    // Calculate min/max x and y
    let xMin = rotated[0].x,
        xMax = rotated[0].x;
    let yMin = rotated[0].y,
        yMax = rotated[0].y;
    for (let i = 1; i < rotated.length; i++) {
        const { x, y } = rotated[i];
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
    }

    return {
        x1: xMin,
        x2: xMax,
        y1: yMin,
        y2: yMax,
    };
};

export const calculatePositionsBoundingBox = (positions: IVector<number>[]): BoundingBox => {
    if (positions.length === 0) {
        return {
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 0,
        };
    }

    const box: BoundingBox = {
        x1: positions[0].x,
        x2: positions[0].x,
        y1: positions[0].y,
        y2: positions[0].y,
    };

    for (let i = 1; i < positions.length; i++) {
        const pos = positions[i];
        if (pos.x < box.x1) box.x1 = pos.x;
        if (pos.x > box.x2) box.x2 = pos.x;
        if (pos.y < box.y1) box.y1 = pos.y;
        if (pos.y > box.y2) box.y2 = pos.y;
    }

    return box;
};

export const boundingBoxesIntersect = (box1: BoundingBox, box2: BoundingBox): boolean => {
    return box1.x1 <= box2.x2 && box1.x2 >= box2.x1 && box1.y1 <= box2.y2 && box1.y2 >= box2.y1;
};

export const OPACITY_THRESHOLD = 0.001;
