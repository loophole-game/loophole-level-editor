import { LevelEditor } from '@/utils/levelEditor';
import { useAppStore } from '@/utils/store';
import { useEffect, useRef } from 'react';
import { EngineCanvas } from '../engine/EngineCanvas';
import TopPanel from './TopPanel';
import TilePicker from './TilePicker';
import { FPSCounter } from '../engine/FPSCounter';

export function LevelEditorComponent() {
    const levelEditorRef = useRef<LevelEditor | null>(null);
    const levels = useAppStore((state) => state.levels);
    const activeLevelID = useAppStore((state) => state.activeLevelID);
    const updateLevel = useAppStore((state) => state.updateLevel);

    const level = levels[activeLevelID];

    useEffect(() => {
        if (!window.engine) {
            levelEditorRef.current = new LevelEditor((level) => updateLevel({ level }), {});
        } else {
            levelEditorRef.current = window.engine as LevelEditor;
            levelEditorRef.current.level = level.level;
        }
    }, [level, updateLevel]);

    return (
        <div className="h-screen w-screen flex flex-col">
            <div className="fixed top-0 left-0">
                <EngineCanvas engineRef={levelEditorRef} />
            </div>
            <div className="h-full flex flex-col p-4 gap-4 z-10 pointer-events-none">
                <TopPanel />
                <TilePicker />
                <FPSCounter className="fixed top-20 right-4 text-right" />
            </div>
        </div>
    );
}
