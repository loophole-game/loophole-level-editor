import { System } from '.';
import type { Engine } from '..';
import type { RenderCommandStats } from './render/command';

const STATS_BUFFER_SIZE = 1;
const FPS_UPDATE_INTERVAL = 1.0;

export interface TraceFrame {
    name: string;
    numCalls?: number;
    time: number;
    subFrames: TraceFrame[];
}

export interface Stats {
    fps: number;
    traces: Readonly<TraceFrame>[];
    renderCommands: Readonly<RenderCommandStats> | null;
}

const createEmptyStats = (fps: number = 0): Stats => ({
    fps,
    traces: [],
    renderCommands: null,
});

export class StatsSystem extends System<Engine> {
    #lastFrameStats: Stats[] = [];
    #currentFrameStats: Stats = createEmptyStats();

    #activeTraceFrameList: TraceFrame[] = [];

    #frameCount: number = 0;
    #fpsTimeAccumulator: number = 0;

    constructor(engine: Engine) {
        super(engine);

        this.#currentFrameStats = this.#syncTraces();
    }

    get stats(): Readonly<Stats> | null {
        return this.#lastFrameStats[this.#lastFrameStats.length - 1];
    }

    update(deltaTime: number) {
        this.#frameCount++;
        this.#fpsTimeAccumulator += deltaTime;
        if (this.#fpsTimeAccumulator >= FPS_UPDATE_INTERVAL) {
            this.#currentFrameStats.fps = Math.round(this.#frameCount / this.#fpsTimeAccumulator);
            this.#frameCount = 0;
            this.#fpsTimeAccumulator = 0;
        }

        this.#currentFrameStats.renderCommands = this._engine.renderSystem.getRenderCommandStats();

        this.#syncTraces();
    }

    trace<T>(name: string, callback: () => T): T {
        const parentTraceFrameList = this.#activeTraceFrameList;
        this.#activeTraceFrameList = [];

        const startTime = performance.now();
        const res = callback();
        const endTime = performance.now();

        parentTraceFrameList.push({
            name,
            numCalls: 1,
            time: endTime - startTime,
            subFrames: this.#activeTraceFrameList,
        });
        this.#activeTraceFrameList = parentTraceFrameList;

        return res;
    }

    #syncTraces() {
        this.#currentFrameStats.traces = this.#aggregateTraces(this.#activeTraceFrameList);
        this.#lastFrameStats.push(this.#currentFrameStats);
        if (this.#lastFrameStats.length > STATS_BUFFER_SIZE) {
            this.#lastFrameStats.shift();
        }
        this.#currentFrameStats = createEmptyStats(this.#currentFrameStats.fps);
        this.#activeTraceFrameList = [];

        return this.#currentFrameStats;
    }

    #aggregateTraces(traceFrames: TraceFrame[]): TraceFrame[] {
        const traceMap = new Map<string, TraceFrame>();
        for (const trace of traceFrames) {
            if (traceMap.has(trace.name)) {
                const aggregatedTrace = traceMap.get(trace.name)!;
                aggregatedTrace.numCalls = (aggregatedTrace.numCalls ?? 1) + (trace.numCalls ?? 1);
                aggregatedTrace.time += trace.time;
                aggregatedTrace.subFrames.push(...trace.subFrames);
            } else {
                traceMap.set(trace.name, trace);
            }
        }

        for (const trace of traceMap.values()) {
            trace.subFrames = this.#aggregateTraces(trace.subFrames);
        }

        return Array.from(traceMap.values());
    }
}
