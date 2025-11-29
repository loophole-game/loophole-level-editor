import { Panel } from '../Panel';
import clsx from 'clsx';
import { Button } from '../ui/button';
import { useAppStore } from '@/utils/stores';
import { Camera } from 'lucide-react';

export function ResetViewportPanel() {
    const levelInViewport = useAppStore((state) => state.levelInViewport);
    const centerCameraOnLevel = useAppStore((state) => state.centerCameraOnLevel);

    return (
        <Panel
            className={clsx('fixed top-20 -right-48 transition-all', {
                'right-4': !levelInViewport,
            })}
        >
            <Button variant="loophole" onClick={() => centerCameraOnLevel()}>
                <Camera />
                Reset Viewport
            </Button>
        </Panel>
    );
}
