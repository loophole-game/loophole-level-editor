import { Entity, type EntityOptions } from './entities';
import { Component, type ComponentOptions } from './components';
import { RenderSystem } from './systems/render';
import { type Camera, type CameraData } from './types';
import type { AvailableScenes, Scene, SceneIdentifier } from './systems/scene';
import { SceneSystem } from './systems/scene';
import {
    PointerButton,
    PointerSystem,
    type CursorType,
    type PointerButtonState,
    type PointerState,
} from './systems/pointer';
import { ImageSystem, type LoadedImage } from './systems/image';
import { KeyboardSystem, type KeyboardKeyState } from './systems/keyboard';
import type { System } from './systems';
import { DEFAULT_CAMERA_OPTIONS } from './utils';
import { CameraSystem } from './systems/camera';
import { Vector, type IVector } from './math';
import { StatsSystem, type Stats } from './systems/stats';

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

    engineTracesEnabled: boolean;
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

    engineTracesEnabled: false,
};

export class Engine<TOptions extends EngineOptions = EngineOptions> {
    protected static _nextId: number = 1;
    protected readonly _id: string = (Engine._nextId++).toString();

    protected _canvas: HTMLCanvasElement | null = null;
    protected _options: TOptions = { ...DEFAULT_ENGINE_OPTIONS } as TOptions;

    protected _rootEntity: Entity<this>;

    protected _renderSystem: RenderSystem;
    protected _sceneSystem: SceneSystem;
    protected _keyboardSystem: KeyboardSystem;
    protected _pointerSystem: PointerSystem;
    protected _imageSystem: ImageSystem;
    protected _cameraSystem: CameraSystem;
    protected _statsSystem: StatsSystem;

    protected _systems: System[] = [];

    protected _lastTime: number = performance.now();

    #forceRender: boolean = true;
    #browserEventHandlers: Partial<Record<BrowserEvent, BrowserEventHandler<BrowserEvent>[]>> = {};

    constructor(options: Partial<TOptions> = {}) {
        this._rootEntity = new Entity({ name: 'root', engine: this });

        // Order of system creation is important
        this._keyboardSystem = new KeyboardSystem(this);
        this._pointerSystem = new PointerSystem(this);
        this._sceneSystem = new SceneSystem(this, this._rootEntity);
        this._imageSystem = new ImageSystem(this);
        this._cameraSystem = new CameraSystem(this, this._rootEntity, this._options.cameraStart);

        // Order isn't important since systems are manually updated
        this._statsSystem = new StatsSystem(this);
        this._renderSystem = new RenderSystem(this);

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

        this._options = { ...DEFAULT_ENGINE_OPTIONS, ...options } as TOptions;

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
        this._pointerSystem.canvas = canvas;
        this.#forceRender = true;
    }

    get canvasSize(): Vector | null {
        if (!this._canvas) {
            return null;
        }

        return new Vector(this._canvas.width, this._canvas.height);
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

    trace<T>(name: string, callback: () => T): T {
        if (!this._options.engineTracesEnabled) {
            return callback();
        }

        return this._statsSystem.trace(name, callback);
    }

    #engineUpdate(deltaTime: number): boolean {
        if (!this._rootEntity.enabled) {
            return false;
        }

        let updated = this.update(deltaTime);
        updated = this._rootEntity.engineUpdate(deltaTime) || updated;
        this._rootEntity.engineLateUpdate(deltaTime, this);

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
            for (const system of this._systems) {
                const updated = system.earlyUpdate(deltaTime);
                if (updated === true) {
                    this.#forceRender = true;
                }
            }

            const engineUpdated = this.#engineUpdate(deltaTime);
            if (engineUpdated) {
                this.#forceRender = true;
            }

            for (const system of this._systems) {
                const updated = system.lateUpdate(deltaTime);
                if (updated === true) {
                    this.#forceRender = true;
                    systemLateUpdated = true;
                }
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

    #applyOptions(newOptions: Partial<TOptions>): void {
        this._options = { ...this._options, ...newOptions };

        this._cameraSystem.clampCameraZoom();

        Object.entries(this._options.images).forEach(([name, src]) => {
            this._imageSystem.loadImage(name, src);
        });
        this._options.images = {};
    }
}
