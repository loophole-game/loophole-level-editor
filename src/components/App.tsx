import { useEffect, useRef } from 'react';
import { EngineCanvas } from './engine/EngineCanvas';
import { Editor } from '../utils/editor';
import type { Engine } from '../utils/engine';
import TopPanel from './ui/TopPanel';
import TilePicker from './ui/TilePicker';

function App() {
    const engineRef = useRef<Engine | null>(null);
    useEffect(() => {
        engineRef.current = window.engine || new Editor();
    }, []);

    return (
        <div className="h-screen w-screen flex flex-col">
            <div className="fixed top-0 left-0">
                <EngineCanvas engineRef={engineRef} />
            </div>
            <div className="h-full flex flex-col p-4 gap-4 z-10 pointer-events-none">
                <TopPanel />
                <TilePicker />
            </div>
        </div>
    );
}

export default App;
