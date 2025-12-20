import { System } from '.';
import type { Engine } from '..';
import { Vector, type IVector } from '../math';
import type { BoundingBox, Camera, CameraData } from '../types';
import { calculateRectangleBoundingBox, DEFAULT_CAMERA_OPTIONS, lerp, zoomToScale } from '../utils';

export class CameraSystem extends System {
    #camera: Required<Camera>;
    #cameraTarget: CameraData | null = null;

    #prevCanvasSize: Vector | null = null;

    #worldToScreenMatrix: DOMMatrix | null = null;
    #inverseWorldToScreenMatrix: DOMMatrix | null = null;
    #worldToScreenMatrixDirty: boolean = true;
    #worldBoundingBox: BoundingBox | null = null;
    #worldBoundingBoxDirty: boolean = true;

    constructor(engine: Engine, cameraStart: CameraData) {
        super(engine);
        this.#camera = { ...DEFAULT_CAMERA_OPTIONS, ...cameraStart };
    }

    get camera(): Readonly<Camera> {
        return this.#camera;
    }

    set camera(newCamera: Partial<CameraData>) {
        this.#camera = { ...DEFAULT_CAMERA_OPTIONS, ...newCamera, dirty: true };
        this.#worldToScreenMatrixDirty = true;
    }

    get cameraTarget(): Readonly<CameraData> | null {
        return this.#cameraTarget;
    }

    set cameraTarget(cameraTarget: CameraData | null) {
        this.#cameraTarget = cameraTarget
            ? {
                  ...cameraTarget,
                  zoom: this.clampCameraZoom(cameraTarget?.zoom),
              }
            : null;
    }

    get worldToScreenMatrix(): Readonly<DOMMatrix> {
        if (!this.#worldToScreenMatrix || this.#worldToScreenMatrixDirty) {
            this.#recomputeWorldMatrix();
        }

        return this.#worldToScreenMatrix!;
    }

    get inverseWorldToScreenMatrix(): Readonly<DOMMatrix> {
        if (!this.#worldToScreenMatrix || this.#worldToScreenMatrixDirty) {
            this.#recomputeWorldMatrix();
        }

        return this.#inverseWorldToScreenMatrix!;
    }

    set worldToScreenMatrixDirty(dirty: boolean) {
        this.#worldToScreenMatrixDirty = dirty;
    }

    get boundingBox(): Readonly<BoundingBox> {
        if (!this.#worldBoundingBox || this.#worldBoundingBoxDirty) {
            if (!this._engine.canvasSize) {
                return {
                    x1: 0,
                    x2: 0,
                    y1: 0,
                    y2: 0,
                };
            }

            // Convert screen dimensions to world space by dividing by scale
            const scale = zoomToScale(this.#camera.zoom);
            const worldSize = {
                x: this._engine.canvasSize.x / scale,
                y: this._engine.canvasSize.y / scale,
            };
            // The world center visible is the inverse of camera position, scaled
            const worldCenter = {
                x: -this.#camera.position.x / scale,
                y: -this.#camera.position.y / scale,
            };

            this.#worldBoundingBox = calculateRectangleBoundingBox(
                worldCenter,
                worldSize,
                -this.#camera.rotation,
                { x: worldSize.x / 2, y: worldSize.y / 2 },
            );
            this.#worldBoundingBoxDirty = false;
        }

        return this.#worldBoundingBox;
    }

    setCameraPosition(position: IVector<number>): void {
        if (this.#camera.position.x !== position.x || this.#camera.position.y !== position.y) {
            this.#camera.position = { x: position.x, y: position.y };
            this.#onCameraChanged();
        }
    }

    setCameraZoom(zoom: number): void {
        if (this.#camera.zoom !== zoom) {
            this.#camera.zoom = zoom;
            this.applyCameraZoomClamp();
            this.#onCameraChanged();
        }
    }

    zoomCamera(delta: number, focalPoint?: IVector<number>): void {
        const oldZoom = this.#camera.zoom;
        const oldScale = zoomToScale(oldZoom);
        this.#camera.zoom += delta * this._engine.options.zoomSpeed;
        this.applyCameraZoomClamp();
        const newScale = zoomToScale(this.#camera.zoom);

        if (focalPoint) {
            const scaleDelta = oldScale - newScale;
            const rotationRad = (this.#camera.rotation * Math.PI) / 180;
            const rotatedFocalPoint = new Vector(focalPoint).rotate(rotationRad);

            this.#camera.position = {
                x: this.#camera.position.x + rotatedFocalPoint.x * scaleDelta,
                y: this.#camera.position.y + rotatedFocalPoint.y * scaleDelta,
            };
        }

        this.#onCameraChanged();
    }

    setCameraRotation(rotation: number): void {
        if (this.#camera.rotation !== rotation) {
            this.#camera.rotation = rotation;
            this.#onCameraChanged();
        }
    }

    override lateUpdate(deltaTime: number): boolean {
        if (
            this._engine.canvasSize &&
            (!this.#prevCanvasSize || !this._engine.canvasSize.equals(this.#prevCanvasSize))
        ) {
            this.#prevCanvasSize = this._engine.canvasSize.clone();
            this.#onCameraChanged();
        }

        const MIN_POS_DELTA = 0.01;
        const MIN_ROT_DELTA = 0.001;
        const MIN_ZOOM_DELTA = 0.001;

        if (this.#cameraTarget) {
            const pos = this.#camera.position;
            const tgtPos = this.#cameraTarget.position;
            const rot = this.#camera.rotation;
            const tgtRot = this.#cameraTarget.rotation;
            const zoom = this.#camera.zoom;
            const tgtZoom = this.#cameraTarget.zoom;

            // Frame-rate independent lerp factor
            const lerpFactor =
                1 - Math.pow(1 - this._engine.options.cameraTargetLerpSpeed, deltaTime * 100);

            function clampStep(from: number, to: number, factor: number, minStep: number) {
                const lerped = lerp(from, to, factor);
                if (Math.abs(lerped - from) < minStep && Math.abs(to - from) > minStep) {
                    return from + Math.sign(to - from) * minStep;
                }
                return lerped;
            }

            const posX = clampStep(pos.x, tgtPos.x, lerpFactor, MIN_POS_DELTA);
            const posY = clampStep(pos.y, tgtPos.y, lerpFactor, MIN_POS_DELTA);

            const newPosition = { x: posX, y: posY };
            const newRotation = clampStep(rot, tgtRot, lerpFactor, MIN_ROT_DELTA);
            const newZoom = clampStep(zoom, tgtZoom, lerpFactor, MIN_ZOOM_DELTA);

            this.#camera.position = newPosition;
            this.#camera.rotation = newRotation;
            this.#camera.zoom = newZoom;

            const posClose =
                Math.abs(newPosition.x - tgtPos.x) < MIN_POS_DELTA &&
                Math.abs(newPosition.y - tgtPos.y) < MIN_POS_DELTA;
            const rotClose = Math.abs(newRotation - tgtRot) < MIN_ROT_DELTA;
            const zoomClose = Math.abs(newZoom - tgtZoom) < MIN_ZOOM_DELTA;

            if (posClose && rotClose && zoomClose) {
                this.#camera.position = { ...tgtPos };
                this.#camera.rotation = tgtRot;
                this.#camera.zoom = tgtZoom;
                this._engine.cameraTarget = null;
            }

            this.#onCameraChanged();
        }

        return this.#camera.dirty;
    }

    postRender(): void {
        this.#camera.dirty = false;
    }

    clampCameraZoom(zoom: number): number {
        return Math.max(this._engine.options.minZoom, Math.min(this._engine.options.maxZoom, zoom));
    }

    applyCameraZoomClamp(): void {
        this.#camera.zoom = this.clampCameraZoom(this.#camera.zoom);
    }

    #onCameraChanged(): void {
        this.#camera.dirty = true;

        if (this._engine.canvasSize) {
            const scale = zoomToScale(this.#camera.zoom);
            const worldSize = {
                x: this._engine.canvasSize.x / scale,
                y: this._engine.canvasSize.y / scale,
            };
            const worldCenterOffset = {
                x: -this.#camera.position.x / scale,
                y: -this.#camera.position.y / scale,
            };

            const rotationRad = (-this.#camera.rotation * Math.PI) / 180;
            const worldCenter = new Vector(worldCenterOffset).rotate(rotationRad).extract();

            const bbox = calculateRectangleBoundingBox(
                worldCenter,
                worldSize,
                -this.#camera.rotation,
                { x: worldSize.x / 2, y: worldSize.y / 2 },
            );
            this.#camera.boundingBox = bbox;
        } else {
            this.#camera.boundingBox = { x1: 0, x2: 0, y1: 0, y2: 0 };
        }

        this.#worldToScreenMatrixDirty = true;
        this.#worldBoundingBoxDirty = true;
    }

    #recomputeWorldMatrix() {
        if (!this._engine.canvasSize) {
            return new DOMMatrix();
        }

        const scale = zoomToScale(this.#camera.zoom);
        this.#worldToScreenMatrix = new DOMMatrix()
            .translate(this._engine.canvasSize.x / 2, this._engine.canvasSize.y / 2)
            .translate(this.#camera.position.x, this.#camera.position.y)
            .rotate(this.#camera.rotation)
            .scale(scale, scale);
        this.#inverseWorldToScreenMatrix = this.#worldToScreenMatrix.inverse();
        this.#worldToScreenMatrixDirty = false;
    }
}
