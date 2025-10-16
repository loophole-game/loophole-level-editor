import type { Engine } from './utils/engine';

declare global {
    interface Window {
        engine: Engine;
    }
}
