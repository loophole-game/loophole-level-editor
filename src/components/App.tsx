import { useEffect, useRef } from 'react';
import { EngineCanvas } from './engine/EngineCanvas';
import { Editor } from '../utils/editor';
import TopPanel from './ui/TopPanel';
import TilePicker from './ui/TilePicker';
import { FPSCounter } from './engine/FPSCounter';
import { useAppStore } from '@/utils/store';

function App() {
    const engineRef = useRef<Editor | null>(null);
    const levels = useAppStore((state) => state.levels);
    const activeLevelID = useAppStore((state) => state.activeLevelID);
    const updateLevel = useAppStore((state) => state.updateLevel);
    const level = levels[activeLevelID];

    useEffect(() => {
        if (!window.engine) {
            engineRef.current = new Editor(level.level, (level) => updateLevel({ level }), {});
        } else {
            engineRef.current = window.engine as Editor;
            engineRef.current.level = level.level;
        }
    }, [level, updateLevel]);

    return (
        <div className="h-screen w-screen flex flex-col">
            <div className="fixed top-0 left-0">
                <EngineCanvas engineRef={engineRef} />
            </div>
            <div className="h-full flex flex-col p-4 gap-4 z-10 pointer-events-none">
                <TopPanel />
                <TilePicker />
                <FPSCounter className="fixed top-20 right-4 text-right" />
            </div>
        </div>
    );
}

export default App;
