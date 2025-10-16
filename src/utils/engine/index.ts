import { v4 } from 'uuid';
import type { Position } from '../levelSchema';
import { Entity } from './entities';
import { renderFrame } from './renderer';

interface EngineOptions {
    zoomSpeed?: number;
    minZoom?: number;
    maxZoom?: number;
}

const DEFAULT_ENGINE_OPTIONS: Required<EngineOptions> = {
    zoomSpeed: 0.001,
    minZoom: 0.1,
    maxZoom: 10,
};

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
    mousedown: { button: number };
    mouseup: { button: number };
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

interface MouseState extends Position {
    onScreen: boolean;
    leftDown: boolean;
    leftPressed: boolean;
    leftReleased: boolean;
    rightDown: boolean;
    rightPressed: boolean;
    rightReleased: boolean;
    middleDown: boolean;
    middlePressed: boolean;
    middleReleased: boolean;
}

export class Engine {
    readonly #id: string = v4();

    #canvas: HTMLCanvasElement | null = null;
    #camera: Required<CameraState>;
    #forceRender: boolean = true;

    #options: Required<EngineOptions> = { ...DEFAULT_ENGINE_OPTIONS };

    #rootEntity: Entity;

    #mouseState: MouseState = {
        x: 0,
        y: 0,
        onScreen: false,
        leftDown: false,
        leftPressed: false,
        leftReleased: false,
        rightDown: false,
        rightPressed: false,
        rightReleased: false,
        middleDown: false,
        middlePressed: false,
        middleReleased: false,
    };
    #lastMouseState: MouseState = { ...this.#mouseState };

    #lastTime: number = performance.now();

    #fps: number = 0;
    #frameCount: number = 0;
    #fpsTimeAccumulator: number = 0;

    #updateTime: number = 0;
    #renderTime: number = 0;

    #browserEventHandlers: Partial<Record<BrowserEvent, BrowserEventHandler<BrowserEvent>[]>> = {};

    constructor() {
        window.engine = this;

        this.#camera = { ...DEFAULT_CAMERA_OPTIONS };
        this.#rootEntity = new Entity('root');

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

        window.requestAnimationFrame(this.#engineLoop);
    }

    get id(): string {
        return this.#id;
    }

    get camera(): Readonly<Required<CameraState>> {
        return this.#camera;
    }

    set camera(camera: CameraState) {
        this.#camera = { ...DEFAULT_CAMERA_OPTIONS, ...camera };
    }

    get canvas(): HTMLCanvasElement | null {
        return this.#canvas;
    }

    set canvas(canvas: HTMLCanvasElement | null) {
        this.#canvas = canvas;
        if (canvas) {
            this.forceRender();
        }
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

    get options(): Readonly<EngineOptions> {
        return this.#options;
    }

    set options(options: EngineOptions) {
        this.#options = { ...this.#options, ...options };
    }

    addEntities(...entities: Entity[]): void {
        this.#rootEntity.addChildren(...entities);
    }

    forceRender(): void {
        this.#forceRender = true;
    }

    mouseToWorld(position: Position, ignorePosition: boolean = false): Position {
        if (!this.#canvas) {
            return position;
        }
        const x = position.x;
        const y = position.y;

        const rotation = -this.#camera.rotation * (Math.PI / 180);
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        const worldX = rotatedX;
        const worldY = rotatedY;

        return {
            x: ignorePosition ? worldX : worldX - this.#camera.position.x * this.#camera.zoom,
            y: ignorePosition ? worldY : worldY - this.#camera.position.y * this.#camera.zoom,
        };
    }

    setCameraPosition(position: Position): void {
        this.#camera.position = position;
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

    #inputs = (): void => {
        this.#mouseState.leftPressed = this.#mouseState.leftDown && !this.#lastMouseState.leftDown;
        this.#mouseState.leftReleased = !this.#mouseState.leftDown && this.#lastMouseState.leftDown;
        this.#mouseState.rightPressed =
            this.#mouseState.rightDown && !this.#lastMouseState.rightDown;
        this.#mouseState.rightReleased =
            !this.#mouseState.rightDown && this.#lastMouseState.rightDown;
        this.#mouseState.middlePressed =
            this.#mouseState.middleDown && !this.#lastMouseState.middleDown;
        this.#mouseState.middleReleased =
            !this.#mouseState.middleDown && this.#lastMouseState.middleDown;
        this.#lastMouseState = { ...this.#mouseState };
    };

    #update = (deltaTime: number): boolean => {
        const startTime = performance.now();

        if (!this.#rootEntity.enabled) {
            this.#updateTime = 0;
            return false;
        }

        let updated = false;
        updated = this.#rootEntity.update(deltaTime) || updated;

        this.#rootEntity.setScale({ x: this.#camera.zoom, y: this.#camera.zoom });
        this.#rootEntity.setRotation(this.#camera.rotation);
        this.#rootEntity.setPosition(this.#camera.position);

        this.#updateTime = performance.now() - startTime;
        return updated;
    };

    #render = () => {
        const startTime = performance.now();

        if (!this.#canvas) {
            this.#renderTime = performance.now() - startTime;
            return;
        }

        const ctx = this.#canvas.getContext('2d');
        if (!ctx) {
            console.error('Failed to get canvas context');
            this.#renderTime = performance.now() - startTime;
            return;
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = this.#camera.clearColor;
        ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

        renderFrame(ctx, this.#rootEntity);

        this.#renderTime = performance.now() - startTime;
    };

    #engineLoop = () => {
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

        if (this.#update(deltaTime) || this.#forceRender) {
            this.#render();
            this.#forceRender = false;
        }

        window.requestAnimationFrame(this.#engineLoop);
    };

    #handleBrowserEvent = (event: BrowserEvent, data: BrowserEventMap[BrowserEvent]) => {
        this.#browserEventHandlers[event]?.forEach((handler) => {
            handler(event, data);
        });
    };

    #setMousePosition(position: Position): void {
        this.#mouseState.x = position.x;
        this.#mouseState.y = position.y;
    }

    #setMouseOnScreen(onScreen: boolean, position: Position): void {
        this.#mouseState.onScreen = onScreen;
        this.#mouseState.x = position.x;
        this.#mouseState.y = position.y;
    }

    #setMouseWheel(delta: number): void {
        this.#camera.zoom += delta * this.#options.zoomSpeed;
        this.#camera.zoom = Math.max(
            this.#options.minZoom,
            Math.min(this.#options.maxZoom, this.#camera.zoom),
        );
    }

    #setMouseButtonDown(button: number, down: boolean): void {
        switch (button) {
            case 0:
                this.#mouseState.leftDown = down;
                break;
            case 1:
                this.#mouseState.middleDown = down;
                break;
            case 2:
                this.#mouseState.rightDown = down;
                break;
            default:
                break;
        }
    }
}
