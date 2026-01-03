import { System } from '.';
import type { Engine } from '..';

const LOG_PREFIX = '[LOG]:';
const WARN_PREFIX = '[WARN]:';
const ERROR_PREFIX = '[ERROR]:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogArgs = any[];

export interface I_Logging {
    log: (...args: LogArgs) => void;
    warn: (...args: LogArgs) => void;
    error: (...args: LogArgs) => void;
    logBeforeFrame: (n: number, ...args: LogArgs) => void;
    warnBeforeFrame: (n: number, ...args: LogArgs) => void;
    errorBeforeFrame: (n: number, ...args: LogArgs) => void;
}

export interface LogOutput {
    log: (...args: LogArgs) => void;
    warn: (...args: LogArgs) => void;
    error: (...args: LogArgs) => void;
}

export class LogSystem extends System implements I_Logging {
    #logOutput: LogOutput | null = null;

    constructor(engine: Engine) {
        super(engine);
    }

    set logOutput(logOutput: LogOutput | null | undefined) {
        this.#logOutput = logOutput ?? null;
    }

    log: I_Logging['log'] = (...args) => {
        this.#logOutput?.log?.(LOG_PREFIX, ...args);
    };

    warn: I_Logging['warn'] = (...args) => {
        this.#logOutput?.warn?.(WARN_PREFIX, ...args);
    };

    error: I_Logging['error'] = (...args) => {
        this.#logOutput?.error?.(ERROR_PREFIX, ...args);
    };

    logBeforeFrame: I_Logging['logBeforeFrame'] = (n, ...args) => {
        if (this._engine.frameCount < n) {
            this.#logOutput?.log(LOG_PREFIX, ...args);
        }
    };

    warnBeforeFrame: I_Logging['warnBeforeFrame'] = (n, ...args) => {
        if (this._engine.frameCount < n) {
            this.#logOutput?.warn(WARN_PREFIX, ...args);
        }
    };

    errorBeforeFrame: I_Logging['errorBeforeFrame'] = (n, ...args) => {
        if (this._engine.frameCount < n) {
            this.#logOutput?.error(ERROR_PREFIX, ...args);
        }
    };
}
