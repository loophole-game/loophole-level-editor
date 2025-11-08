import { useAppStore } from '@/utils/stores';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { Lock, Unlock, Plus, Shuffle } from 'lucide-react';
import type { Loophole_ExtendedEntityType } from '@/utils/levelEditor/externalLevelSchema';
import { ENTITY_METADATA } from '@/utils/utils';
import { Button } from '../ui/button';
import clsx from 'clsx';
import { useMemo } from 'react';

const ALL_ENTITY_TYPES = Object.keys(ENTITY_METADATA) as Loophole_ExtendedEntityType[];

interface LayerButtonsProps {
    groupClassName?: string;
}

export function LayerButtons({ groupClassName }: LayerButtonsProps) {
    const lockedLayers = useAppStore((state) => state.lockedLayers);
    const setLockedLayer = useAppStore((state) => state.setLockedLayer);
    const _editableLayers = useAppStore((state) => state.editableLayers);
    const addEditableLayer = useAppStore((state) => state.addEditableLayer);
    const removeEditableLayer = useAppStore((state) => state.removeEditableLayer);

    const editableLayers = useMemo(() => {
        const locked = Object.keys(lockedLayers).filter(
            (layer) => lockedLayers[layer as Loophole_ExtendedEntityType],
        ) as Loophole_ExtendedEntityType[];
        const set = new Set<Loophole_ExtendedEntityType>([..._editableLayers, ...locked]);
        return Array.from(set);
    }, [_editableLayers, lockedLayers]);

    return (
        <div className="flex flex-col gap-2 w-full">
            <ToggleGroup
                type="multiple"
                spacing={2}
                size="sm"
                className={clsx('w-full flex-wrap', groupClassName)}
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
                            data-on={isLocked}
                            variant="default"
                            className={clsx({
                                '!bg-background !text-foreground': !isLocked,
                                '!bg-accent !border-accent !text-accent-foreground': isLocked,
                            })}
                        >
                            {isLocked ? <Lock /> : <Unlock />}
                            {name}
                        </ToggleGroupItem>
                    );
                })}
                <div className="flex items-center gap-2">
                    <Button
                        variant="loophole"
                        size="icon-sm"
                        onClick={() => {
                            for (const layer of ALL_ENTITY_TYPES) {
                                setLockedLayer(layer, !lockedLayers[layer]);
                            }
                        }}
                    >
                        <Shuffle />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="loophole" size="icon-sm">
                                <Plus />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                            <DropdownMenuLabel>Lockable Layers</DropdownMenuLabel>
                            {ALL_ENTITY_TYPES.map((layer) => {
                                const { name } = ENTITY_METADATA[layer];
                                const isEditable = editableLayers.includes(layer);

                                return (
                                    <DropdownMenuCheckboxItem
                                        key={layer}
                                        checked={isEditable}
                                        onCheckedChange={(checked) => {
                                            setTimeout(() => {
                                                if (checked) {
                                                    addEditableLayer(layer);
                                                    setLockedLayer(layer, true);
                                                } else {
                                                    removeEditableLayer(layer);
                                                }
                                            }, 100);
                                        }}
                                    >
                                        {name}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </ToggleGroup>
        </div>
    );
}
