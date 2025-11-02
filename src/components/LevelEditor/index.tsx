import { LevelEditor } from '@/utils/levelEditor';
import { useAppStore } from '@/utils/store';
import { useEffect, useRef } from 'react';
import { EngineCanvas } from '../engine/EngineCanvas';
import TopPanel from './TopPanel';
import TilePicker from './TilePicker';
import { FPSCounter } from '../engine/FPSCounter';
import { LayerButtons } from './LayerButtons';
import { EntityInspector } from './EntityInspector';
import type { Loophole_Level } from '@/utils/levelEditor/externalLevelSchema';

export function LevelEditorComponent() {
    const levelEditorRef = useRef<LevelEditor | null>(null);
    const levels = useAppStore((state) => state.levels);
    const activeLevelID = useAppStore((state) => state.activeLevelID);
    const updateLevel = useAppStore((state) => state.updateLevel);
    const levelHashes = useAppStore((state) => state.levelHashes);
    const userSettings = useAppStore((state) => state.userSettings);

    const level = levels[activeLevelID];
    const levelHash = levelHashes[activeLevelID];
    const prevLevelHash = useRef<number | null>(null);

    useEffect(() => {
        const onLevelChanged = (updatedLevel: Loophole_Level) => {
            updateLevel(level.id, { level: updatedLevel });
        };
        if (!window.engine) {
            levelEditorRef.current = new LevelEditor(onLevelChanged);
        } else {
            if (prevLevelHash.current !== levelHash) {
                levelEditorRef.current = window.engine as LevelEditor;
                levelEditorRef.current.level = level.level;
                prevLevelHash.current = levelHash;
            }

            if (levelEditorRef.current) {
                levelEditorRef.current.onLevelChanged = onLevelChanged;
            }
        }
    }, [activeLevelID, levelHash, level, updateLevel]);

    return (
        <div className="h-screen w-screen flex flex-col">
            <div className="fixed top-0 left-0">
                <EngineCanvas
                    engineRef={levelEditorRef}
                    scrollDirection={userSettings.scrollDirection}
                />
            </div>
            <div className="h-full flex flex-col p-4 gap-4 z-10 pointer-events-none">
                <TopPanel />
                <div className="h-full flex flex-col gap-4 max-w-[18.5rem]">
                    <TilePicker />
                    <LayerButtons />
                    <EntityInspector className="mt-auto" />
                </div>
                <FPSCounter className="fixed bottom-4 right-4 text-right" />
            </div>
        </div>
    );
}
