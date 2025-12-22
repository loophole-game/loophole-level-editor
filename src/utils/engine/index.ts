import { Entity, type EntityOptions } from './entities';
import { Component, type ComponentOptions } from './components';
import { RenderSystem } from './systems/render';
import { type Camera, type CameraData, type WebKey } from './types';
import { Scene, type SceneIdentifier, type SceneOptions } from './systems/scene';
import { SceneSystem } from './systems/scene';
import {
    PointerButton,
    PointerSystem,
    type CursorType,
    type PointerButtonState,
    type PointerState,
} from './systems/pointer';
import { ImageSystem, type LoadedImage } from './systems/image';
import type { System } from './systems';
import { DEFAULT_CAMERA_OPTIONS } from './utils';
import { CameraSystem } from './systems/camera';
import { type IVector } from './math';
import { StatsSystem, type Stats } from './systems/stats';
import { DebugOverlayScene } from './scenes/DebugOverlay';
import {
    InputSystem,
    type AxisState,
    type ButtonState,
    type InputConfig,
    type KeyboardKeyState,
} from './systems/input';

const DEBUG_OVERLAY_SCENE_NAME = '__ENGINE_DEBUG_SCENE__';
const DEBUG_OVERLAY_SCENE_Z_INDEX = 100;

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

    keydown: { key: WebKey; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean };
    keyup: { key: WebKey; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean };
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

export type SceneConstructor<T extends Scene = Scene, TEngine extends Engine = Engine> = new (
    options: SceneOptions<TEngine>,
) => T;

export interface EngineOptions {
    zoomSpeed: number;
    minZoom: number;
    maxZoom: number;
    clearColor: string;

    startScenes: Array<SceneConstructor>;

    cameraStart: CameraData;
    cameraDrag: boolean;
    cameraDragButtons: PointerButton[];
    cameraTargetLerpSpeed: number;

    images: Record<string, string | HTMLImageElement>;

    inputConfigs: Record<string, InputConfig>;
    keysToCapture: KeyCapture[];

    asyncImageLoading: boolean;

    alwaysRender: boolean;
    engineTracesEnabled: boolean;
    debugOverlayEnabled: boolean;
}

const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
    zoomSpeed: 0.001,
    minZoom: -3, // 2^-3 = 0.125 (1/8x scale)
    maxZoom: 3, // 2^3 = 8 (8x scale)
    clearColor: 'black',

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

    inputConfigs: {},
    keysToCapture: [],

    asyncImageLoading: true,

    alwaysRender: false,
    engineTracesEnabled: false,
    debugOverlayEnabled: false,
};

export class Engine<TOptions extends EngineOptions = EngineOptions> {
    protected static _nextId: number = 1;
    protected readonly _id: string = (Engine._nextId++).toString();

    protected _canvas: HTMLCanvasElement | null = null;
    protected _options: TOptions = { ...DEFAULT_ENGINE_OPTIONS } as TOptions;

    protected _rootEntity: Entity<this>;

    protected _renderSystem: RenderSystem;
    protected _sceneSystem: SceneSystem;
    protected _inputSystem: InputSystem;
    protected _pointerSystem: PointerSystem;
    protected _imageSystem: ImageSystem;
    protected _cameraSystem: CameraSystem;
    protected _statsSystem: StatsSystem;

    protected _systems: System[] = [];

    protected _lastTime: number = performance.now();

    #debugOverlayScene: Scene | null = null;

    #forceRender: boolean = true;
    #boundEngineLoop = this.#engineLoop.bind(this);
    #animationFrameHandleId: number | null = null;
    #browserEventHandlers: Partial<Record<BrowserEvent, BrowserEventHandler<BrowserEvent>[]>> = {};

    // Saves needing to re-allocate in temp functions
    #tempPoint: DOMPoint = new DOMPoint();

    constructor(options: Partial<TOptions> = {}) {
        this._rootEntity = new Entity({ name: 'root', engine: this });

        // Order of system creation is important
        this._inputSystem = new InputSystem(this);
        this._pointerSystem = new PointerSystem(this);
        this._sceneSystem = new SceneSystem(this, this._rootEntity);
        this._imageSystem = new ImageSystem(this);
        this._cameraSystem = new CameraSystem(this, this._options.cameraStart);

        // Order isn't important since systems are manually updated
        this._statsSystem = new StatsSystem(this);
        this._renderSystem = new RenderSystem(this);

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
        this.addBrowserEventHandler('keydown', (_, data) =>
            this.#setKeyDown(data.key, true, data.ctrl, data.meta, data.shift, data.alt),
        );
        this.addBrowserEventHandler('keyup', (_, data) =>
            this.#setKeyDown(data.key, false, data.ctrl, data.meta, data.shift, data.alt),
        );

        this._options = { ...DEFAULT_ENGINE_OPTIONS, ...options } as TOptions;
        this.#applyOptions(this._options);

        for (const sceneCtor of this._options.startScenes) {
            this.openScene(sceneCtor);
        }

        window.requestAnimationFrame(this.#boundEngineLoop);
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
        this._pointerSystem.canvas = canvas;
        this.#forceRender = true;
    }

    get canvasSize(): IVector<number> | null {
        if (!this._canvas) {
            return null;
        }

        return { x: this._canvas.width, y: this._canvas.height };
    }

    get options(): Readonly<TOptions> {
        return this._options;
    }

    set options(newOptions: Partial<TOptions>) {
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

    get inverseWorldToScreenMatrix(): Readonly<DOMMatrix> {
        return this._cameraSystem.inverseWorldToScreenMatrix;
    }

    get pointerState(): Readonly<PointerState> {
        return this._pointerSystem.pointerState;
    }

    get stats(): Readonly<Stats> | null {
        return this._statsSystem.stats;
    }

    get pointerSystem(): PointerSystem {
        return this._pointerSystem;
    }

    get cameraSystem(): CameraSystem {
        return this._cameraSystem;
    }

    get sceneSystem(): SceneSystem {
        return this._sceneSystem;
    }

    requestCursor(id: string, type: CursorType, priority?: number): void {
        this._pointerSystem.requestCursor(id, type, priority);
    }

    forceRender(): void {
        this.#forceRender = true;
    }

    addSystem(system: System): void {
        this._systems.push(system);
    }

    addEntities<T extends Entity<this>, TOptions extends EntityOptions<this> = EntityOptions<this>>(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine'> & { scene?: string },
    ): T;
    addEntities<T extends Entity<this>, TOptions extends EntityOptions<this> = EntityOptions<this>>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: (Omit<TOptions, 'engine'> & { scene?: string })[]
    ): T[];
    addEntities<T extends Entity<this>, TOptions extends EntityOptions<this> = EntityOptions<this>>(
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

    createComponent<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        options: Omit<TOptions, 'engine'>,
    ): T;
    createComponent<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: Omit<TOptions, 'engine'>[]
    ): T[];
    createComponent<T extends Component, TOptions extends ComponentOptions = ComponentOptions>(
        ctor: new (options: TOptions) => T,
        ...optionObjs: Omit<TOptions, 'engine'>[]
    ): T | T[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instances = optionObjs.map((option) => new ctor({ ...option, engine: this } as any));

        return instances.length === 1 ? instances[0] : instances;
    }

    openScene<T extends Scene>(
        sceneCtor: SceneConstructor<T, this>,
        options?: Omit<SceneOptions<this>, 'engine'>,
    ): T {
        const scene = new sceneCtor({ engine: this, ...options });
        this._sceneSystem.openScene(scene);

        return scene;
    }

    destroyScene(scene: SceneIdentifier): void {
        this._sceneSystem.closeScene(scene);
    }

    screenToWorld(position: IVector<number>): IVector<number> {
        if (!this._canvas) {
            return position;
        }

        const point = this.#tempPoint;
        point.x = position.x;
        point.y = position.y;
        const p = this.inverseWorldToScreenMatrix.transformPoint(point);

        return { x: p.x, y: p.y };
    }

    worldToScreen(position: IVector<number>): IVector<number> {
        if (!this._canvas) {
            return position;
        }

        const point = this.#tempPoint;
        point.x = position.x;
        point.y = position.y;
        const p = this.worldToScreenMatrix.transformPoint(point);

        return { x: p.x, y: p.y };
    }

    getKey(keyCode: WebKey): Readonly<KeyboardKeyState> {
        return this._inputSystem.getKey(keyCode);
    }

    getButton(button: string): Readonly<ButtonState> {
        return this._inputSystem.getButton(button);
    }

    getAxis(axis: string): Readonly<AxisState> {
        return this._inputSystem.getAxis(axis);
    }

    resetAllKeyboardKeys(): void {
        this._inputSystem.releaseAllKeys();
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

    setCameraPosition(position: IVector<number>, cancelCameraTarget: boolean = true): void {
        this._cameraSystem.setCameraPosition(position);
        if (cancelCameraTarget) {
            this.cameraTarget = null;
        }
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

        for (const system of this._systems) {
            system.destroy();
        }
        this._systems = [];

        if (this.#animationFrameHandleId) {
            window.cancelAnimationFrame(this.#animationFrameHandleId);
            this.#animationFrameHandleId = null;
        }
    }

    trace<T>(name: string, callback: () => T): T {
        if (!this._options.engineTracesEnabled) {
            return callback();
        }

        return this._statsSystem.trace(name, callback);
    }

    openDebugOverlay(): void {
        if (!this.#debugOverlayScene) {
            this.#debugOverlayScene = this.openScene(DebugOverlayScene, {
                name: DEBUG_OVERLAY_SCENE_NAME,
                zIndex: DEBUG_OVERLAY_SCENE_Z_INDEX,
            });
        }
    }

    closeDebugOverlay(): void {
        this.destroyScene(DEBUG_OVERLAY_SCENE_NAME);
        this.#debugOverlayScene = null;
    }

    #engineUpdate(deltaTime: number): boolean {
        if (!this._rootEntity.enabled) {
            return false;
        }

        let updated = this.update(deltaTime);
        updated = this._rootEntity.engineUpdate(deltaTime) || updated;

        return updated;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    #render() {
        if (!this._canvas || !this.canvasSize) {
            return;
        }

        const ctx = this._canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context');
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
    }

    #engineLoop() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this._lastTime) * 0.001;
        this._lastTime = currentTime;
        this._statsSystem.update(deltaTime);
        let systemLateUpdated = false;

        this.trace('Update', () => {
            this.#forceRender = this.options.alwaysRender;

            for (const system of this._systems) {
                this.trace(`${system.constructor.name}.early`, () => {
                    const updated = system.earlyUpdate(deltaTime) ?? false;
                    if (updated === true) {
                        this.#forceRender = true;
                    }
                });
            }

            this.trace('engineUpdate', () => {
                const engineUpdated = this.#engineUpdate(deltaTime);
                if (engineUpdated) {
                    this.#forceRender = true;
                }
            });

            for (const system of this._systems) {
                this.trace(`${system.constructor.name}.late`, () => {
                    const updated = system.lateUpdate(deltaTime) ?? false;
                    if (updated === true) {
                        this.#forceRender = true;
                        systemLateUpdated = true;
                    }
                });
            }

            const loadingImages = this._imageSystem.getLoadingImages();
            this.#forceRender =
                this.#forceRender && (this.options.asyncImageLoading || loadingImages.length === 0);
        });

        this.trace('Render', () => {
            if (this.#forceRender) {
                this.#render();
                this.#forceRender = false;
            }
        });

        if (systemLateUpdated) {
            this.#forceRender = true;
        }

        this.#animationFrameHandleId = window.requestAnimationFrame(this.#boundEngineLoop);
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
        key: WebKey,
        down: boolean,
        ctrl: boolean,
        meta: boolean,
        shift: boolean,
        alt: boolean,
    ): boolean {
        return this._inputSystem.keyStateChange(key, down, ctrl, meta, shift, alt);
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

    #applyOptions(newOptions: Partial<TOptions>): void {
        this._options = { ...this._options, ...newOptions };

        this._cameraSystem.applyCameraZoomClamp();

        for (const name in this._options.images) {
            const src = this._options.images[name];
            this._imageSystem.loadImage(name, src);
        }
        this._options.images = {};

        if (newOptions.inputConfigs) {
            this._inputSystem.setInputConfigs(newOptions.inputConfigs);
        }

        if (this._options.debugOverlayEnabled !== Boolean(this.#debugOverlayScene)) {
            if (this._options.debugOverlayEnabled) {
                this.openDebugOverlay();
            } else {
                this.closeDebugOverlay();
            }
        }
    }
}
