import { Panel } from '../Panel';
import { isMac } from '@/utils/engine/utils';
import clsx from 'clsx';
import { BoxSelectIcon, Brush, Camera, PanelRight, PencilRuler, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettingsStore } from '@/utils/stores';
import { Separator } from '../ui/separator';

import { type ComponentType } from 'react';

interface Keybinding {
    action: string;
    keys: string[];
    separator?: 'or' | 'and';
}

interface Heading {
    Icon: ComponentType;
    heading: string;
}

const META = isMac ? '⌘' : 'Ctrl';
const KEYBINDINGS: (Keybinding | Heading)[] = [
    { Icon: Camera, heading: 'Camera' },
    { action: 'Move Camera', keys: ['W/A/S/D', 'Arrow Keys'], separator: 'or' },
    { action: 'Zoom', keys: ['+', '-'] },
    { action: 'Reset Viewport', keys: [`${META} + F`] },
    { action: 'Pan Camera', keys: ['Click + Drag'] },

    { Icon: Brush, heading: 'Tile Brush' },
    { action: 'Rotate Brush', keys: ['Q/E/R'], separator: 'or' },
    { action: 'Cycle Brush', keys: ['[/]', `${META} + Scroll`], separator: 'or' },
    { action: 'Brush Hotkeys', keys: ['0-9'] },
    { action: 'Clear Brush', keys: ['Esc'] },

    { Icon: BoxSelectIcon, heading: 'Selection' },
    { action: 'Select', keys: ['Click'] },
    { action: 'Multi-Select', keys: ['Shift + Click'] },
    { action: 'Select All', keys: [`${META} + A`] },

    { Icon: PencilRuler, heading: 'Editing' },
    { action: 'Delete', keys: ['Delete', 'Backspace'], separator: 'or' },
    { action: 'Undo and Redo', keys: [`${META} + Z`, `${META} + Y`], separator: 'and' },

    { Icon: PanelRight, heading: 'Interface' },
    { action: 'Toggle UI Panels', keys: [`${META} + /`] },
    { action: 'Toggle Debug Stats', keys: [`${META} + K`] },
];

interface KeybindingsPanelProps {
    className?: string;
}

export function KeybindingsPanel({ className }: KeybindingsPanelProps) {
    const setUserSettings = useSettingsStore((state) => state.setUserSettings);

    return (
        <Panel className={clsx('fixed top-22 right-4 w-80 z-20', className)}>
            <div className="relative">
                <Button
                    variant="loophole"
                    size="icon"
                    className="absolute -top-5 -right-5 h-6 w-6 rounded-full"
                    onClick={() => setUserSettings({ showKeybindings: false })}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="space-y-1 text-xs max-h-[calc(100vh-120px)] overflow-y-auto">
                {KEYBINDINGS.map((binding, idx) => {
                    if ('Icon' in binding) {
                        return (
                            <div
                                key={idx}
                                className={clsx('text-lg font-bold flex flex-col gap-1', {
                                    'mt-4': idx > 0,
                                })}
                            >
                                <span className="flex items-center gap-2">
                                    <binding.Icon />
                                    {binding.heading}
                                </span>
                                <Separator />
                            </div>
                        );
                    }

                    const { action, keys, separator = 'or' } = binding;

                    return (
                        <div
                            key={idx}
                            className="flex items-center justify-between gap-9 py-1 text-muted"
                        >
                            <span>{action}</span>
                            <div className="flex items-center gap-1 flex-wrap justify-end">
                                {keys.flatMap((key, keyIdx) => {
                                    const elements = [];
                                    if (keyIdx > 0) {
                                        elements.push(
                                            <span
                                                key={`or-${keyIdx}`}
                                                className="text-xs text-muted"
                                            >
                                                {separator}
                                            </span>,
                                        );
                                    }
                                    elements.push(
                                        <kbd
                                            key={`key-${keyIdx}`}
                                            className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono whitespace-nowrap"
                                        >
                                            {key}
                                        </kbd>,
                                    );

                                    return elements;
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}
