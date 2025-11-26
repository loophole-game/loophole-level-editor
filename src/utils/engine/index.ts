import { Entity, type EntityOptions } from './entities';
import { Component, type ComponentOptions } from './components';
import { RenderSystem } from './systems/render';
import { type Camera, type CameraData } from './types';
import type { AvailableScenes, Scene, SceneIdentifier } from './systems/scene';
import { SceneSystem } from './systems/scene';
import {
    PointerButton,
    PointerSystem,
    type PointerButtonState,
    type PointerState,
} from './systems/pointer';
import { ImageSystem, type LoadedImage } from './systems/image';
import { KeyboardSystem, type KeyboardKeyState } from './systems/keyboard';
import type { System } from './systems';
import { DEFAULT_CAMERA_OPTIONS } from './utils';
import { CameraSystem } from './systems/camera';
import { CursorSystem, type CursorType } from './systems/cursor';
import { Vector, type IVector } from './math';

type BrowserEvent =
    | 'mousemove'
    | 'mousewheel'
    | 'mousedown'
    | 'mouseup'
    | 'mouseenter'
    | 'mouseleave'
    | 'mouseover'
    | 'mouseout'
    | 'keydown'
    | 'keyup';

interface BrowserEventMap {
    mousemove: { x: number; y: number };
    mousewheel: { delta: number };
    mousedown: { button: PointerButton };
    mouseup: { button: PointerButton };
    mouseenter: { target: EventTarget | null; x: number; y: number };
    mouseleave: { target: EventTarget | null; x: number; y: number };
    mouseover: { from: EventTarget | null; to: EventTarget | null };
    mouseout: { from: EventTarget | null; to: EventTarget | null };

    keydown: { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean };
    keyup: { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean };
}

type BrowserEventHandler<T extends BrowserEvent> = (
    event: T,
    data: BrowserEventMap[T],
) => void | boolean;

interface KeyCapture {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
}

export interface EngineOptions {
    zoomSpeed: number;
    minZoom: number;
    maxZoom: number;
    clearColor: string;

    scenes: AvailableScenes;
    startScenes: string[];

    cameraStart: CameraData;
    cameraDrag: boolean;
    cameraDragButtons: PointerButton[];
    cameraTargetLerpSpeed: number;

    images: Record<string, string | HTMLImageElement>;

    keysToCapture: KeyCapture[];

    asyncImageLoading: boolean;
}

const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
    zoomSpeed: 0.001,
    minZoom: -3, // 2^-3 = 0.125 (1/8x scale)
    maxZoom: 3, // 2^3 = 8 (8x scale)
    clearColor: 'black',

    scenes: {},
    startScenes: [],

    cameraStart: {
        position: DEFAULT_CAMERA_OPTIONS.position,
        rotation: DEFAULT_CAMERA_OPTIONS.rotation,
        zoom: DEFAULT_CAMERA_OPTIONS.zoom,
    },
    cameraDrag: false,
    cameraDragButtons: [PointerButton.MIDDLE, PointerButton.RIGHT],
    cameraTargetLerpSpeed: 0.1,

    images: {},

    keysToCapture: [],

    asyncImageLoading: true,
};

export class Engine {
    protected static _nextId: number = 1;
    protected readonly _id: string = (Engine._nextId++).toString();

    protected _canvas: HTMLCanvasElement | null = null;
    protected _options: EngineOptions = { ...DEFAULT_ENGINE_OPTIONS };

    protected _rootEntity: Entity<this>;

    protected _renderSystem: RenderSystem;
    protected _sceneSystem: SceneSystem;
    protected _keyboardSystem: KeyboardSystem;
    protected _pointerSystem: PointerSystem;
    protected _imageSystem: ImageSystem;
    protected _cameraSystem: CameraSystem;
    protected _cursorSystem: CursorSystem;

    protected _systems: System[] = [];

    #forceRender: boolean = true;
    #lastTime: number = performance.now();

    #fps: number = 0;
    #frameCount: number = 0;
    #fpsTimeAccumulator: number = 0;

    #updateTime: number = 0;
    #renderTime: number = 0;

    #browserEventHandlers: Partial<Record<BrowserEvent, BrowserEventHandler<BrowserEvent>[]>> = {};

    constructor(options: Partial<EngineOptions> = {}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.engine = this as unknown as any;

        this._rootEntity = new Entity({ name: 'root', engine: this });
        this._renderSystem = new RenderSystem(this);
        this._sceneSystem = new SceneSystem(this, this._rootEntity);
        this._keyboardSystem = new KeyboardSystem(this);
        this._pointerSystem = new PointerSystem(this);
        this._imageSystem = new ImageSystem(this);
        this._cameraSystem = new CameraSystem(this, this._rootEntity, this._options.cameraStart);
        this._cursorSystem = new CursorSystem(this);

        this.addBrowserEventHandler('mousedown', (_, data) =>
            this.#setPointerButtonDown(data.button, true),
        );
        this.addBrowserEventHandler('mouseup', (_, data) =>
            this.#setPointerButtonDown(data.button, false),
        );
        this.addBrowserEventHandler('mousemove', (_, data) =>
            this.#setPointerPosition(new Vector(data.x, data.y)),
        );
        this.addBrowserEventHandler('mouseenter', (_, data) =>
            this.#setPointerOnScreen(true, new Vector(data.x, data.y)),
        );
        this.addBrowserEventHandler('mouseleave', (_, data) =>
            this.#setPointerOnScreen(false, new Vector(data.x, data.y)),
        );
        this.addBrowserEventHandler('mousewheel', (_, { delta }) =>
            this.#setPointerScrollDelta(delta),
        );
        this.addBrowserEventHandler('keydown', (_, data) =>
            this.#setKeyDown(data.key, true, data.ctrl, data.meta, data.shift, data.alt),
        );
        this.addBrowserEventHandler('keyup', (_, data) =>
            this.#setKeyDown(data.key, false, data.ctrl, data.meta, data.shift, data.alt),
        );

        this._options = { ...DEFAULT_ENGINE_OPTIONS, ...options };

        this.#applyOptions(this._options);
        this._options.startScenes.forEach((scene) => {
            this.createScene(scene);
        });

        window.requestAnimationFrame(this.#engineLoop.bind(this));
    }

    get id(): string {
        return this._id;
    }

    get canvas(): HTMLCanvasElement | null {
        return this._canvas;
    }

    set canvas(canvas: HTMLCanvasElement | null) {
        this._canvas = canvas;
        this._cameraSystem.worldToScreenMatrixDirty = true;
        this._cursorSystem.setCanvas(canvas);
        this.#forceRender = true;
    }

    get canvasSize(): Vector | null {
        if (!this._canvas) {
            return null;
        }

        return new Vector(this._canvas.width, this._canvas.height);
    }

    get options(): Readonly<EngineOptions> {
        return this._options;
    }

    set options(newOptions: Partial<EngineOptions>) {
        this.#applyOptions(newOptions);
    }

    get camera(): Readonly<Camera> {
        return this._cameraSystem.camera;
    }

    set camera(newCamera: Partial<CameraData>) {
        this._cameraSystem.camera = newCamera;
    }

    set cameraTarget(cameraTarget: CameraData | null) {
        this._cameraSystem.cameraTarget = cameraTarget;
    }

    get rootEntity(): Readonly<Entity> {
        return this._rootEntity;
    }

    get worldToScreenMatrix(): Readonly<DOMMatrix> {
        return this._cameraSystem.worldToScreenMatrix;
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

    get pointerSystem(): PointerSystem {
        return this._pointerSystem;
    }

    get cameraSystem(): CameraSystem {
        return this._cameraSystem;
    }

    get cursorSystem(): CursorSystem {
        return this._cursorSystem;
    }

    get sceneSystem(): SceneSystem {
        return this._sceneSystem;
    }

    requestCursor(id: string, type: CursorType, priority?: number): void {
        this._cursorSystem.requestCursor(id, type, priority);
    }

    cancelCursorRequest(id: string): void {
        this._cursorSystem.cancelCursorRequest(id);
    }

    forceRender(): void {
        this.#forceRender = true;
    }

    addSystem(system: System): void {
        this._systems.push(system);
    }

    add<T extends Entity<this>, TOptions extends EntityOptions<this> = EntityOptions<this>>(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine'> & { scene?: string },
    ): T;
    add<T extends Entity<this>, TOptions extends EntityOptions<this> = EntityOptions<this>>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: (Omit<TOptions, 'engine'> & { scene?: string })[]
    ): T[];
    add<T extends Entity<this>, TOptions extends EntityOptions<this> = EntityOptions<this>>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: (Omit<TOptions, 'engine'> & { scene?: string })[]
    ): T | T[] {
        const instances = optionObjs.map((option) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entity = new ctor({ ...option, engine: this } as any);
            if (option.scene) {
                this._sceneSystem.registerEntities(option.scene, entity);
            } else {
                entity.parent = this._rootEntity;
            }

            return entity;
        });
        return instances.length === 1 ? instances[0] : instances;
    }

    /**
     * Factory method to create a single component with engine reference automatically injected.
     * Usage: engine.addComponent(C_Shape, { ...options })
     */
    addComponent<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine'>,
    ): T;
    /**
     * Factory method to create multiple components with engine reference automatically injected.
     * Usage: engine.addComponent(C_Shape, { ...options1 }, { ...options2 })
     */
    addComponent<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: Omit<TOptions, 'engine'>[]
    ): T[];
    addComponent<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: Omit<TOptions, 'engine'>[]
    ): T | T[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instances = optionObjs.map((option) => new ctor({ ...option, engine: this } as any));
        return instances.length === 1 ? instances[0] : instances;
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

    screenToWorld(position: IVector<number>): IVector<number> {
        if (!this._canvas) {
            return position;
        }

        const screenToWorldMatrix = this.worldToScreenMatrix.inverse();
        const p = screenToWorldMatrix.transformPoint(new DOMPoint(position.x, position.y));

        return new Vector(p.x, p.y);
    }

    worldToScreen(position: IVector<number>): IVector<number> {
        if (!this._canvas) {
            return position;
        }

        const p = this.worldToScreenMatrix.transformPoint(new DOMPoint(position.x, position.y));
        return new Vector(p.x, p.y);
    }

    getKey(keyCode: string): Readonly<KeyboardKeyState> {
        return this._keyboardSystem.getKey(keyCode);
    }

    resetAllKeyboardKeys(): void {
        this._keyboardSystem.releaseAllKeys();
    }

    getPointerButton(button: PointerButton): Readonly<PointerButtonState> {
        return this._pointerSystem.getPointerButton(button);
    }

    capturePointerButtonClick(button: PointerButton): void {
        return this._pointerSystem.capturePointerButtonClick(button);
    }

    setCamera(camera: CameraData): void {
        this._cameraSystem.setCameraPosition(camera.position);
        this._cameraSystem.setCameraRotation(camera.rotation);
        this._cameraSystem.setCameraZoom(camera.zoom);
    }

    setCameraPosition(position: IVector<number>): void {
        this._cameraSystem.setCameraPosition(position);
    }

    setCameraZoom(zoom: number): void {
        this._cameraSystem.setCameraZoom(zoom);
    }

    zoomCamera(delta: number, focalPoint?: IVector<number>): void {
        this._cameraSystem.zoomCamera(delta, focalPoint);
    }

    setCameraRotation(rotation: number): void {
        this._cameraSystem.setCameraRotation(rotation);
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

    onKeyDown: BrowserEventHandler<'keydown'> = (...args) => this.#handleBrowserEvent(...args);
    onKeyUp: BrowserEventHandler<'keyup'> = (...args) => this.#handleBrowserEvent(...args);

    destroy(): void {
        this._rootEntity.destroy();

        this._systems.forEach((system) => {
            system.destroy();
        });
        this._systems = [];
    }

    #engineUpdate(deltaTime: number): boolean {
        if (!this._rootEntity.enabled) {
            this.#updateTime = 0;
            return false;
        }

        const startTime = performance.now();
        let updated = this.update(deltaTime);
        updated = this._rootEntity.engineUpdate(deltaTime) || updated;

        this._rootEntity.engineLateUpdate(deltaTime, this);

        this.#updateTime = performance.now() - startTime;

        return updated;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
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
        if (this.options.clearColor && this.options.clearColor !== 'transparent') {
            ctx.fillStyle = this.options.clearColor;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        } else {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
        ctx.translate(canvasWidth / 2, canvasHeight / 2);

        this._renderSystem.render(ctx, this._rootEntity, this._cameraSystem.camera);
        this._cameraSystem.postRender();

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

        this._keyboardSystem.update(deltaTime);
        this._pointerSystem.update(deltaTime);
        const sceneUpdated = this._sceneSystem.update(deltaTime);
        const imagesUpdated = this._imageSystem.update();
        const engineUpdated = this.#engineUpdate(deltaTime);
        const cameraUpdated = this._cameraSystem.update();

        const loadingImages = this._imageSystem.getLoadingImages();
        if (
            (this.#forceRender ||
                sceneUpdated ||
                engineUpdated ||
                imagesUpdated ||
                cameraUpdated) &&
            (this.options.asyncImageLoading || loadingImages.length === 0)
        ) {
            this.#render();
            this.#forceRender = false;
        } else {
            this.#renderTime = -1;
        }

        window.requestAnimationFrame(this.#engineLoop.bind(this));
    }

    #handleBrowserEvent(event: BrowserEvent, data: BrowserEventMap[BrowserEvent]): boolean {
        let preventDefault = false;
        this.#browserEventHandlers[event]?.forEach((handler) => {
            const result = handler(event, data);
            if (result === true) {
                preventDefault = true;
            }
        });

        return preventDefault;
    }

    #setKeyDown(
        key: string,
        down: boolean,
        ctrl: boolean,
        meta: boolean,
        shift: boolean,
        alt: boolean,
    ): boolean {
        return this._keyboardSystem.keyStateChange(key, down, ctrl, meta, shift, alt);
    }

    #setPointerPosition(position: IVector<number>): void {
        this._pointerSystem.pointerPosition.set(position);
    }

    #setPointerOnScreen(onScreen: boolean, position: IVector<number>): void {
        this._pointerSystem.pointerPosition.set(position);
        this._pointerSystem.pointerOnScreen = onScreen;
    }

    #setPointerScrollDelta(delta: number): void {
        this._pointerSystem.pointerScrollDelta = delta;
    }

    #setPointerButtonDown(button: PointerButton, down: boolean): void {
        this._pointerSystem.pointerButtonStateChange(button, down);
    }

    #applyOptions(newOptions: Partial<EngineOptions>): void {
        this._options = { ...this._options, ...newOptions };

        this._cameraSystem.clampCameraZoom();

        Object.entries(this._options.images).forEach(([name, src]) => {
            this._imageSystem.loadImage(name, src);
        });
        this._options.images = {};
    }
}
