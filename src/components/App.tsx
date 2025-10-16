import { useEffect, useRef } from 'react';
import { EngineCanvas } from './engine/EngineCanvas';
import { Editor } from '../utils/editor';
import { FPSCounter } from './engine/FPSCounter';

function App() {
    const editorRef = useRef<Editor>(null);
    useEffect(() => {
        editorRef.current = window.engine || new Editor();
    }, []);

    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <EngineCanvas engineRef={editorRef} />
            <div className="absolute bottom-4 left-4 text-white text-sm">
                <FPSCounter />
            </div>
        </div>
    );
}

export default App;
