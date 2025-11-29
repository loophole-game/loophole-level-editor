import { Panel } from './Panel';
import clsx from 'clsx';
import { SidebarOpenIcon } from 'lucide-react';
import { Button } from './ui/button';
import { useAppStore } from '@/utils/stores';

export function OpenInterfacePanel() {
    const interfaceHidden = useAppStore((state) => state.interfaceHidden);
    const setInterfaceHidden = useAppStore((state) => state.setInterfaceHidden);

    return (
        <Panel
            className={clsx('fixed top-4 right-4 transition-all', {
                'opacity-0 pointer-events-none translate-x-18 -translate-y-18': !interfaceHidden,
            })}
        >
            <Button variant="loophole" onClick={() => setInterfaceHidden(false)}>
                <SidebarOpenIcon className="rotate-180" />
            </Button>
        </Panel>
    );
}
