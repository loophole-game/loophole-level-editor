import type { LevelEditor } from './utils/levelEditor';

declare global {
    interface Window {
        engine?: LevelEditor | null;
    }
}
