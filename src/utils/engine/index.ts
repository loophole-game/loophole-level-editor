import { Entity } from './entities';
import { RenderSystem } from './systems/render';
import { MouseButton, type MouseState, type Position } from './types';
import type { AvailableScenes, Scene, SceneIdentifier } from './systems/scene';
import { SceneSystem } from './systems/scene';

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

    cameraStart?: CameraState;
    startScenes?: string[];
}

const DEFAULT_ENGINE_OPTIONS: Required<EngineOptions> = {
    zoomSpeed: 0.001,
    minZoom: 0.1,
    maxZoom: 10,
    scenes: {},

    cameraStart: { ...DEFAULT_CAMERA_OPTIONS },
    startScenes: [],
};

export class Engine {
    protected static _nextId: number = 1;
    protected readonly _id: number = Engine._nextId++;

    _canvas: HTMLCanvasElement | null = null;
    _options: Required<EngineOptions> = { ...DEFAULT_ENGINE_OPTIONS, scenes: {} };

    _camera: Required<CameraState>;
    _rootEntity: Entity;

    _renderSystem: RenderSystem;
    _sceneSystem: SceneSystem;

    #forceRender: boolean = true;
    #mouseState: MouseState = {
        justMoved: false,
        x: 0,
        y: 0,
        onScreen: false,
        [MouseButton.LEFT]: { down: false, pressed: false, released: false },
        [MouseButton.MIDDLE]: { down: false, pressed: false, released: false },
        [MouseButton.RIGHT]: { down: false, pressed: false, released: false },
    };
    #lastMouseState: MouseState = { ...this.#mouseState };

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
        this._renderSystem = new RenderSystem();
        this._sceneSystem = new SceneSystem(this._rootEntity);

        this.addBrowserEventHandler('mousedown', (_, data) =>
            this.#setMouseButtonDown(data.button, true),
        );
        this.addBrowserEventHandler('mouseup', (_, data) =>
            this.#setMouseButtonDown(data.button, false),
        );
        this.addBrowserEventHandler('mousemove', (_, data) => this.#setMousePosition(data));
        this.addBrowserEventHandler('mouseenter', (_, data) => this.#setMouseOnScreen(true, data));
        this.addBrowserEventHandler('mouseleave', (_, data) => this.#setMouseOnScreen(false, data));
        this.addBrowserEventHandler('mousewheel', (_, { delta }) => this.#setMouseWheel(delta));

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
    }

    get canvasSize(): Position | null {
        if (!this._canvas) {
            return null;
        }

        return { x: this._canvas.width, y: this._canvas.height };
    }

    get options(): Readonly<EngineOptions> {
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
    }

    get rootEntity(): Readonly<Entity> {
        return this._rootEntity;
    }

    get mouseState(): Readonly<MouseState> {
        return { ...this.#mouseState };
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

        const scene = this._options.scenes[sceneID](name);
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

    mouseToWorld(position: Position, ignorePosition: boolean = false): Position {
        if (!this._canvas) {
            return position;
        }
        const x = position.x - this._canvas.width / 2;
        const y = position.y - this._canvas.height / 2;

        const rotation = -this._camera.rotation * (Math.PI / 180);
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        const worldX = rotatedX;
        const worldY = rotatedY;

        return {
            x: ignorePosition ? worldX : worldX - this._camera.position.x * this._camera.zoom,
            y: ignorePosition ? worldY : worldY - this._camera.position.y * this._camera.zoom,
        };
    }

    setCameraPosition(position: Position): void {
        this._camera.position = position;
    }

    setCameraZoom(zoom: number): void {
        this._camera.zoom = zoom;
    }

    setCameraRotation(rotation: number): void {
        this._camera.rotation = rotation;
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

    #inputs(): void {
        this.#mouseState.justMoved =
            this.#mouseState.x !== this.#lastMouseState.x ||
            this.#mouseState.y !== this.#lastMouseState.y;
        Object.values(MouseButton).forEach((button: MouseButton) => {
            this.#mouseState[button].pressed =
                this.#mouseState[button].down && !this.#lastMouseState[button].down;
            this.#mouseState[button].released =
                !this.#mouseState[button].down && this.#lastMouseState[button].down;
        });

        this.#lastMouseState = {
            ...this.#mouseState,
            [MouseButton.LEFT]: { ...this.#mouseState[MouseButton.LEFT] },
            [MouseButton.MIDDLE]: { ...this.#mouseState[MouseButton.MIDDLE] },
            [MouseButton.RIGHT]: { ...this.#mouseState[MouseButton.RIGHT] },
        };
    }

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
    _update(_deltaTime: number): boolean {
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

        this.#inputs();
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

    #setMousePosition(position: Position): void {
        this.#mouseState.x = position.x;
        this.#mouseState.y = position.y;
        this.#mouseState.justMoved = true;
        this.#mouseState.onScreen = true;
    }

    #setMouseOnScreen(onScreen: boolean, position: Position): void {
        this.#mouseState.onScreen = onScreen;
        this.#mouseState.x = position.x;
        this.#mouseState.y = position.y;
    }

    #setMouseWheel(delta: number): void {
        this._camera.zoom += delta * this._options.zoomSpeed;
        this._camera.zoom = Math.max(
            this._options.minZoom,
            Math.min(this._options.maxZoom, this._camera.zoom),
        );
    }

    #setMouseButtonDown(button: MouseButton, down: boolean): void {
        this.#mouseState[button].down = down;
    }

    #applyOptions(newOptions: EngineOptions): void {
        this._camera.zoom = Math.max(
            this._options.minZoom,
            Math.min(this._options.maxZoom, this._camera.zoom),
        );

        this._options = { ...this._options, ...newOptions };
    }
}
