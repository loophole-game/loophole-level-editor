import { Entity } from './entities';
import { RenderSystem } from './systems/render';
import { type Position } from './types';
import type { AvailableScenes, Scene, SceneIdentifier } from './systems/scene';
import { SceneSystem } from './systems/scene';
import {
    MouseButton,
    PointerSystem,
    type MouseButtonState,
    type PointerState,
} from './systems/pointer';
import { ImageSystem, type LoadedImage } from './systems/image';

type BrowserEvent =
    | 'mousemove'
    | 'mousewheel'
    | 'mousedown'
    | 'mouseup'
    | 'mouseenter'
    | 'mouseleave'
    | 'mouseover'
    | 'mouseout';

interface BrowserEventMap {
    mousemove: { x: number; y: number };
    mousewheel: { delta: number };
    mousedown: { button: MouseButton };
    mouseup: { button: MouseButton };
    mouseenter: { target: EventTarget | null; x: number; y: number };
    mouseleave: { target: EventTarget | null; x: number; y: number };
    mouseover: { from: EventTarget | null; to: EventTarget | null };
    mouseout: { from: EventTarget | null; to: EventTarget | null };
}

type BrowserEventHandler<T extends BrowserEvent> = (event: T, data: BrowserEventMap[T]) => void;

interface CameraState {
    zoom?: number;
    rotation?: number;
    position?: Position;
    clearColor?: string;
}

const DEFAULT_CAMERA_OPTIONS: Required<CameraState> = {
    zoom: 1,
    rotation: 0,
    position: { x: 0, y: 0 },
    clearColor: 'black',
};

export interface EngineOptions {
    zoomSpeed?: number;
    minZoom?: number;
    maxZoom?: number;

    scenes?: AvailableScenes;
    startScenes?: string[];

    cameraStart?: CameraState;
    cameraDrag?: boolean;
    cameraDragButtons?: MouseButton[];

    images?: Record<string, string | HTMLImageElement>;
}

const DEFAULT_ENGINE_OPTIONS: Required<EngineOptions> = {
    zoomSpeed: 0.001,
    minZoom: 0.1,
    maxZoom: 10,

    scenes: {},
    startScenes: [],

    cameraStart: { ...DEFAULT_CAMERA_OPTIONS },
    cameraDrag: false,
    cameraDragButtons: [MouseButton.MIDDLE, MouseButton.RIGHT],

    images: {},
};

export class Engine {
    protected static _nextId: number = 1;
    protected readonly _id: number = Engine._nextId++;

    protected _canvas: HTMLCanvasElement | null = null;
    protected _options: Required<EngineOptions> = { ...DEFAULT_ENGINE_OPTIONS };

    protected _camera: Required<CameraState>;
    protected _rootEntity: Entity;

    protected _worldToScreenMatrix: DOMMatrix | null = null;
    #worldToScreenMatrixDirty: boolean = true;

    protected _renderSystem: RenderSystem;
    protected _sceneSystem: SceneSystem;
    protected _pointerSystem: PointerSystem;
    protected _imageSystem: ImageSystem;

    #forceRender: boolean = true;

    #lastTime: number = performance.now();

    #fps: number = 0;
    #frameCount: number = 0;
    #fpsTimeAccumulator: number = 0;

    #updateTime: number = 0;
    #renderTime: number = 0;

    #browserEventHandlers: Partial<Record<BrowserEvent, BrowserEventHandler<BrowserEvent>[]>> = {};

    constructor(options: EngineOptions = {}) {
        window.engine = this;
        this._rootEntity = new Entity('root');
        this._renderSystem = new RenderSystem(this);
        this._sceneSystem = new SceneSystem(this, this._rootEntity);
        this._pointerSystem = new PointerSystem(this);
        this._imageSystem = new ImageSystem();

        this.addBrowserEventHandler('mousedown', (_, data) =>
            this.#setPointerButtonDown(data.button, true),
        );
        this.addBrowserEventHandler('mouseup', (_, data) =>
            this.#setPointerButtonDown(data.button, false),
        );
        this.addBrowserEventHandler('mousemove', (_, data) => this.#setPointerPosition(data));
        this.addBrowserEventHandler('mouseenter', (_, data) =>
            this.#setPointerOnScreen(true, data),
        );
        this.addBrowserEventHandler('mouseleave', (_, data) =>
            this.#setPointerOnScreen(false, data),
        );
        this.addBrowserEventHandler('mousewheel', (_, { delta }) =>
            this.#setPointerScrollDelta(delta),
        );

        this._options = { ...DEFAULT_ENGINE_OPTIONS, ...options };
        this._camera = { ...DEFAULT_CAMERA_OPTIONS, ...this._options.cameraStart };

        this.#applyOptions(this._options);
        this._options.startScenes.forEach((scene) => {
            this.createScene(scene);
        });

        window.requestAnimationFrame(this.#engineLoop.bind(this));
    }

    get id(): number {
        return this._id;
    }

    get canvas(): HTMLCanvasElement | null {
        return this._canvas;
    }

    set canvas(canvas: HTMLCanvasElement | null) {
        this._canvas = canvas;
        if (canvas) {
            this.forceRender();
        }
        this.#worldToScreenMatrixDirty = true;
    }

    get canvasSize(): Position | null {
        if (!this._canvas) {
            return null;
        }

        return { x: this._canvas.width, y: this._canvas.height };
    }

    get options(): Readonly<Required<EngineOptions>> {
        return this._options;
    }

    set options(newOptions: EngineOptions) {
        this.#applyOptions(newOptions);
    }

    get camera(): Readonly<Required<CameraState>> {
        return this._camera;
    }

    set camera(newCamera: CameraState) {
        this._camera = { ...DEFAULT_CAMERA_OPTIONS, ...newCamera };
        this.#worldToScreenMatrixDirty = true;
    }

    get rootEntity(): Readonly<Entity> {
        return this._rootEntity;
    }

    get worldToScreenMatrix(): Readonly<DOMMatrix> {
        if (!this._worldToScreenMatrix || this.#worldToScreenMatrixDirty) {
            if (!this.canvasSize) {
                return new DOMMatrix();
            }

            this._worldToScreenMatrix = new DOMMatrix()
                .translate(this.canvasSize.x / 2, this.canvasSize.y / 2)
                .translate(this._camera.position.x, this._camera.position.y)
                .rotate(this._camera.rotation)
                .scale(this._camera.zoom, this._camera.zoom);
            this.#worldToScreenMatrixDirty = false;
        }

        return this._worldToScreenMatrix;
    }

    get pointerState(): Readonly<PointerState> {
        return this._pointerSystem.pointerState;
    }

    get fps(): number {
        return this.#fps;
    }

    get updateTime(): number {
        return this.#updateTime;
    }

    get renderTime(): number {
        return this.#renderTime;
    }

    createScene(sceneID: string, name?: string): Scene | null {
        if (!this._options.scenes[sceneID]) {
            return null;
        }

        const scene = this._options.scenes[sceneID](name ?? sceneID);
        this._sceneSystem.createScene(scene);
        return scene;
    }

    destroyScene(scene: SceneIdentifier): void {
        this._sceneSystem.destroyScene(scene);
    }

    addEntities(...entities: Entity[]): void {
        this.addSceneEntities('', ...entities);
    }

    addSceneEntities(sceneName: string, ...entities: Entity[]): void {
        this._sceneSystem.addEntities(sceneName, ...entities);
    }

    forceRender(): void {
        this.#forceRender = true;
    }

    screenToWorld(position: Position): Position {
        if (!this._canvas) {
            return position;
        }

        const screenToWorldMatrix = this.worldToScreenMatrix.inverse();
        const p = screenToWorldMatrix.transformPoint(new DOMPoint(position.x, position.y));

        return { x: p.x, y: p.y };
    }

    worldToScreen(position: Position): Position {
        if (!this._canvas) {
            return position;
        }

        return this.worldToScreenMatrix.transformPoint(new DOMPoint(position.x, position.y));
    }

    getPointerButton(button: MouseButton): MouseButtonState {
        return this._pointerSystem.getPointerButton(button);
    }

    setCameraPosition(position: Position): void {
        this._camera.position = position;
        this.#worldToScreenMatrixDirty = true;
    }

    setCameraZoom(zoom: number): void {
        this._camera.zoom = zoom;
        this.#clampCameraZoom();
        this.#worldToScreenMatrixDirty = true;
    }

    zoomCamera(delta: number): void {
        this._camera.zoom += delta * this._options.zoomSpeed;
        this.#clampCameraZoom();
        this.#worldToScreenMatrixDirty = true;
    }

    setCameraRotation(rotation: number): void {
        this._camera.rotation = rotation;
        this.#worldToScreenMatrixDirty = true;
    }

    getImage(name: string): Readonly<LoadedImage> | null {
        return this._imageSystem.getImage(name);
    }

    addBrowserEventHandler<T extends BrowserEvent>(
        event: T,
        handler: BrowserEventHandler<T>,
    ): void {
        this.#browserEventHandlers[event] ??= [];
        (this.#browserEventHandlers[event] as BrowserEventHandler<T>[]).push(handler);
    }

    removeBrowserEventHandler<T extends BrowserEvent>(
        event: T,
        handler: BrowserEventHandler<T>,
    ): void {
        if (this.#browserEventHandlers[event]) {
            this.#browserEventHandlers[event] = this.#browserEventHandlers[event].filter(
                (h) => h !== handler,
            );
        }
    }

    onMouseMove: BrowserEventHandler<'mousemove'> = (...args) => this.#handleBrowserEvent(...args);
    onMouseWheel: BrowserEventHandler<'mousewheel'> = (...args) =>
        this.#handleBrowserEvent(...args);
    onMouseDown: BrowserEventHandler<'mousedown'> = (...args) => this.#handleBrowserEvent(...args);
    onMouseUp: BrowserEventHandler<'mouseup'> = (...args) => this.#handleBrowserEvent(...args);
    onMouseEnter: BrowserEventHandler<'mouseenter'> = (...args) =>
        this.#handleBrowserEvent(...args);
    onMouseLeave: BrowserEventHandler<'mouseleave'> = (...args) =>
        this.#handleBrowserEvent(...args);
    onMouseOver: BrowserEventHandler<'mouseover'> = (...args) => this.#handleBrowserEvent(...args);

    #update(deltaTime: number): boolean {
        const startTime = performance.now();

        if (!this._rootEntity.enabled) {
            this.#updateTime = 0;
            return false;
        }

        let updated = this._update(deltaTime);
        updated = this._rootEntity.update(deltaTime) || updated;

        this._rootEntity.setScale({ x: this._camera.zoom, y: this._camera.zoom });
        this._rootEntity.setRotation(this._camera.rotation);
        this._rootEntity.setPosition(this._camera.position);

        this.#updateTime = performance.now() - startTime;
        return updated;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected _update(_deltaTime: number): boolean {
        return false;
    }

    #render() {
        const startTime = performance.now();

        if (!this._canvas || !this.canvasSize) {
            this.#renderTime = performance.now() - startTime;
            return;
        }

        const ctx = this._canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context');
            this.#renderTime = performance.now() - startTime;
            return;
        }

        const { x: canvasWidth, y: canvasHeight } = this.canvasSize;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = this._camera.clearColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.translate(canvasWidth / 2, canvasHeight / 2);

        this._renderSystem.render(ctx, this._rootEntity);

        this.#renderTime = performance.now() - startTime;
    }

    #engineLoop() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.#lastTime) * 0.001;
        this.#lastTime = currentTime;

        this.#frameCount++;
        this.#fpsTimeAccumulator += deltaTime;
        if (this.#fpsTimeAccumulator >= 1.0) {
            this.#fps = Math.round(this.#frameCount / this.#fpsTimeAccumulator);
            this.#frameCount = 0;
            this.#fpsTimeAccumulator = 0;
        }

        this._pointerSystem.update(deltaTime);
        const sceneUpdated = this._sceneSystem.update(deltaTime);

        const entityUpdated = this.#update(deltaTime);
        if (sceneUpdated || entityUpdated || this.#forceRender) {
            this.#render();
            this.#forceRender = false;
        }

        window.requestAnimationFrame(this.#engineLoop.bind(this));
    }

    #handleBrowserEvent(event: BrowserEvent, data: BrowserEventMap[BrowserEvent]) {
        this.#browserEventHandlers[event]?.forEach((handler) => {
            handler(event, data);
        });
    }

    #setPointerPosition(position: Position): void {
        this._pointerSystem.pointerPosition = position;
    }

    #setPointerOnScreen(onScreen: boolean, position: Position): void {
        this._pointerSystem.pointerPosition = position;
        this._pointerSystem.pointerOnScreen = onScreen;
    }

    #setPointerScrollDelta(delta: number): void {
        this._pointerSystem.pointerScrollDelta = delta;
    }

    #setPointerButtonDown(button: MouseButton, down: boolean): void {
        this._pointerSystem.pointerButtonStateChange(button, down);
    }

    #applyOptions(newOptions: EngineOptions): void {
        this._options = { ...this._options, ...newOptions };

        this.#clampCameraZoom();

        Object.entries(this._options.images).forEach(([name, src]) => {
            this._imageSystem.loadImage(name, src);
        });
        this._options.images = {};
    }

    #clampCameraZoom(): void {
        this._camera.zoom = Math.max(
            this._options.minZoom,
            Math.min(this._options.maxZoom, this._camera.zoom),
        );
    }
}
