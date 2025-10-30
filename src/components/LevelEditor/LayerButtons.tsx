import { useAppStore } from '@/utils/store';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { Lock, Unlock, Plus } from 'lucide-react';
import type { Loophole_ExtendedEntityType } from '@/utils/levelEditor/externalLevelSchema';
import { ENTITY_METADATA } from '@/utils/utils';
import clsx from 'clsx';

const ALL_ENTITY_TYPES = Object.keys(ENTITY_METADATA) as Loophole_ExtendedEntityType[];

export function LayerButtons() {
    const lockedLayers = useAppStore((state) => state.lockedLayers);
    const setLockedLayer = useAppStore((state) => state.setLockedLayer);
    const editableLayers = useAppStore((state) => state.editableLayers);
    const addEditableLayer = useAppStore((state) => state.addEditableLayer);
    const removeEditableLayer = useAppStore((state) => state.removeEditableLayer);

    return (
        <div className="flex flex-col gap-2 w-full">
            <ToggleGroup
                type="multiple"
                variant="outline"
                spacing={2}
                size="sm"
                className="w-full pointer-events-auto flex-wrap"
            >
                {editableLayers.map((layer) => {
                    const { name } = ENTITY_METADATA[layer];
                    const isLocked = lockedLayers[layer] ?? false;

                    return (
                        <ToggleGroupItem
                            value={layer}
                            onClick={() => {
                                setLockedLayer(layer, !isLocked);
                            }}
                            key={layer}
                            aria-selected={isLocked}
                            className={clsx('font-bold hover:cursor-pointer transition-colors', {
                                'text-white': !isLocked,
                                'text-muted-foreground bg-white': isLocked,
                            })}
                        >
                            {isLocked ? <Lock /> : <Unlock />}
                            {name}
                        </ToggleGroupItem>
                    );
                })}
                <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium text-white shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 pointer-events-auto">
                        <Plus />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 text-white">
                        <DropdownMenuLabel>Select Lockable Layers</DropdownMenuLabel>
                        {ALL_ENTITY_TYPES.map((layer) => {
                            const { name } = ENTITY_METADATA[layer];
                            const isEditable = editableLayers.includes(layer);

                            return (
                                <DropdownMenuCheckboxItem
                                    key={layer}
                                    checked={isEditable}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            addEditableLayer(layer);
                                        } else {
                                            removeEditableLayer(layer);
                                        }
                                    }}
                                >
                                    {name}
                                </DropdownMenuCheckboxItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </ToggleGroup>
        </div>
    );
}
