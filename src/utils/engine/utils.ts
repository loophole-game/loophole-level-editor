import type { BoundingBox, Camera, Position } from './types';

export const lerp = (from: number, to: number, t: number): number => {
    return from + (to - from) * t;
};

export const positionsEqual = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

export const lerpPosition = (from: Position, to: Position, t: number): Position => {
    return {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
    };
};

export const isMac = navigator.platform.toUpperCase().includes('MAC');

export const DEFAULT_CAMERA_OPTIONS: Camera = {
    zoom: 0,
    rotation: 0,
    position: { x: 0, y: 0 },
    dirty: false,
};

export const zoomToScale = (zoom: number): number => {
    return Math.pow(2, zoom);
};

export const scaleToZoom = (scale: number): number => {
    return Math.log2(scale);
};

export const calculateBoundingBox = (positions: Position[]): BoundingBox => {
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

export const vectorOrNumberToVector = <T>(
    vector:
        | T
        | {
              x: T;
              y: T;
          },
): {
    x: T;
    y: T;
} => {
    if (typeof vector === 'object' && vector !== null) {
        return vector as { x: T; y: T };
    } else {
        return { x: vector as T, y: vector as T };
    }
};

/**
 * Check if a bounding box is visible within the camera viewport.
 * This is used for frustum culling to skip rendering off-screen entities.
 * 
 * Note: The camera.position represents the camera offset in screen space.
 * Positive camera.position.x moves the view right, positive y moves down.
 */
export const isBoxInView = (
    box: BoundingBox,
    camera: Camera,
    canvasWidth: number,
    canvasHeight: number,
    padding: number = 100, // Extra padding to handle entities partially visible
): boolean => {
    const scale = zoomToScale(camera.zoom);
    
    // Calculate the view bounds in world space
    // The camera position is an offset applied in screen space
    const halfWidth = (canvasWidth / 2) / scale;
    const halfHeight = (canvasHeight / 2) / scale;
    
    // View center in world space (camera position is negated for world bounds)
    const viewCenterX = -camera.position.x / scale;
    const viewCenterY = -camera.position.y / scale;
    
    const viewLeft = viewCenterX - halfWidth - padding;
    const viewRight = viewCenterX + halfWidth + padding;
    const viewTop = viewCenterY - halfHeight - padding;
    const viewBottom = viewCenterY + halfHeight + padding;
    
    // Check if box intersects with view bounds
    return !(
        box.x2 < viewLeft ||
        box.x1 > viewRight ||
        box.y2 < viewTop ||
        box.y1 > viewBottom
    );
};
