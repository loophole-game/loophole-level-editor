import { useEffect } from 'react';
import { LevelEditorComponent } from './LevelEditor';
import { useAppStore } from '@/utils/stores';

function App() {
    const setInterfaceHidden = useAppStore((state) => state.setInterfaceHidden);
    const interfaceHidden = useAppStore((state) => state.interfaceHidden);

    useEffect(() => {
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.stopPropagation();
                setInterfaceHidden(!interfaceHidden);
            }
        };
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [setInterfaceHidden, interfaceHidden]);

    return <LevelEditorComponent />;
}

export default App;
