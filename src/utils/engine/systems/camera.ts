import { System } from '.';
import type { Engine } from '..';
import type { Entity } from '../entities';
import type { Camera, CameraData, Position } from '../types';
import { DEFAULT_CAMERA_OPTIONS, lerp } from '../utils';

export class CameraSystem extends System {
    #camera: Required<Camera>;
    #cameraTarget: CameraData | null = null;
    #rootEntity: Entity;

    #worldToScreenMatrix: DOMMatrix | null = null;
    #worldToScreenMatrixDirty: boolean = true;

    constructor(engine: Engine, rootEntity: Entity, cameraStart: CameraData) {
        super(engine);
        this.#rootEntity = rootEntity;
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
        this.#cameraTarget = cameraTarget;
    }

    get worldToScreenMatrix(): Readonly<DOMMatrix> {
        if (!this.#worldToScreenMatrix || this.#worldToScreenMatrixDirty) {
            if (!this._engine.canvasSize) {
                return new DOMMatrix();
            }

            this.#worldToScreenMatrix = new DOMMatrix()
                .translate(this._engine.canvasSize.x / 2, this._engine.canvasSize.y / 2)
                .translate(this.#camera.position.x, this.#camera.position.y)
                .rotate(this.#camera.rotation)
                .scale(this.#camera.zoom, this.#camera.zoom);
            this.#worldToScreenMatrixDirty = false;
        }

        return this.#worldToScreenMatrix;
    }

    set worldToScreenMatrixDirty(dirty: boolean) {
        this.#worldToScreenMatrixDirty = dirty;
    }

    setCameraPosition(position: Position): void {
        if (this.#camera.position.x !== position.x || this.#camera.position.y !== position.y) {
            this.#camera.position = position;
            this.#worldToScreenMatrixDirty = true;
            this.#camera.dirty = true;
        }
    }

    setCameraZoom(zoom: number): void {
        if (this.#camera.zoom !== zoom) {
            this.#camera.zoom = zoom;
            this.#worldToScreenMatrixDirty = true;
            this.#camera.dirty = true;
        }
    }

    zoomCamera(delta: number, focalPoint?: Position): void {
        const oldZoom = this.#camera.zoom;
        this.#camera.zoom += delta * this._engine.options.zoomSpeed;
        this.clampCameraZoom();
        
        // If a focal point is provided, adjust camera position to zoom towards that point
        if (focalPoint) {
            // The world-to-screen transform is: screenPos = worldPos * zoom + cameraPos + screenCenter
            // To keep the focal point at the same screen position after zooming:
            // focalPoint * oldZoom + oldCameraPos = focalPoint * newZoom + newCameraPos
            // Therefore: newCameraPos = oldCameraPos + focalPoint * (oldZoom - newZoom)
            const zoomDelta = oldZoom - this.#camera.zoom;
            this.#camera.position = {
                x: this.#camera.position.x + focalPoint.x * zoomDelta,
                y: this.#camera.position.y + focalPoint.y * zoomDelta,
            };
        }
        
        this.#worldToScreenMatrixDirty = true;
        this.#camera.dirty = true;
    }

    setCameraRotation(rotation: number): void {
        if (this.#camera.rotation !== rotation) {
            this.#camera.rotation = rotation;
            this.#worldToScreenMatrixDirty = true;
            this.#camera.dirty = true;
        }
    }

    update(): boolean {
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

            function clampStep(from: number, to: number, factor: number, minStep: number) {
                const lerped = lerp(from, to, factor);
                if (Math.abs(lerped - from) < minStep && Math.abs(to - from) > minStep) {
                    return from + Math.sign(to - from) * minStep;
                }
                return lerped;
            }

            const posX = clampStep(
                pos.x,
                tgtPos.x,
                this._engine.options.cameraTargetLerpSpeed,
                MIN_POS_DELTA,
            );
            const posY = clampStep(
                pos.y,
                tgtPos.y,
                this._engine.options.cameraTargetLerpSpeed,
                MIN_POS_DELTA,
            );

            const newPosition = { x: posX, y: posY };
            const newRotation = clampStep(
                rot,
                tgtRot,
                this._engine.options.cameraTargetLerpSpeed,
                MIN_ROT_DELTA,
            );
            const newZoom = clampStep(
                zoom,
                tgtZoom,
                this._engine.options.cameraTargetLerpSpeed,
                MIN_ZOOM_DELTA,
            );

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

            this.#camera.dirty = true;
            this.#worldToScreenMatrixDirty = true;
        }

        this.#rootEntity.setScale(this.#camera.zoom);
        this.#rootEntity.setRotation(this.#camera.rotation);
        this.#rootEntity.setPosition(this.#camera.position);

        return this.#camera.dirty;
    }

    postRender(): void {
        this.#camera.dirty = false;
    }

    destroy(): void {}

    clampCameraZoom(): void {
        this.#camera.zoom = Math.max(
            this._engine.options.minZoom,
            Math.min(this._engine.options.maxZoom, this.#camera.zoom),
        );
    }
}
