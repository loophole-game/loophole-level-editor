import {
    AppWindow,
    Camera,
    File,
    Grid,
    Mouse,
    Paintbrush,
    Plus,
    RefreshCw,
    Rocket,
    Settings,
    Trash2,
    Upload,
    Wrench,
} from 'lucide-react';
import { useAppStore, useCurrentLevel, useSettingsStore } from '../../utils/stores';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Panel } from '../Panel';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
    COLOR_PALETTE_METADATA,
    createLevelWithMetadata,
    DEFAULT_LEVEL_NAME,
    formatToSnakeCase,
    Loophole_ColorPalette,
} from '@/utils/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog';
import { v4 } from 'uuid';
import { useState } from 'react';
import type {
    Loophole_Level,
    Loophole_InternalLevel,
} from '@/utils/levelEditor/externalLevelSchema';
import clsx from 'clsx';

interface TopPanelProps {
    className?: string;
}

export default function TopPanel({ className }: TopPanelProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const levels = useAppStore((state) => state.levels);
    const currentLevel = useCurrentLevel();
    const updateLevel = useAppStore((state) => state.updateLevel);
    const resetLevel = useAppStore((state) => state.resetLevel);
    const addLevel = useAppStore((state) => state.addLevel);
    const removeLevel = useAppStore((state) => state.removeLevel);
    const setActiveLevelID = useAppStore((state) => state.setActiveLevelID);
    const centerCameraOnLevel = useAppStore((state) => state.centerCameraOnLevel);
    const setInterfaceHidden = useAppStore((state) => state.setInterfaceHidden);

    const scrollDirection = useSettingsStore((state) => state.scrollDirection);
    const scrollSensitivity = useSettingsStore((state) => state.scrollSensitivity);
    const showEngineStats = useSettingsStore((state) => state.showEngineStats);
    const showGrid = useSettingsStore((state) => state.showGrid);
    const setUserSettings = useSettingsStore((state) => state.setUserSettings);

    if (!currentLevel) return null;

    const { name } = currentLevel;
    const levelName = name.trim() || DEFAULT_LEVEL_NAME;

    const downloadLevel = () => {
        const level = currentLevel;
        const levelJSON = JSON.stringify(level, null, 2);
        const blob = new Blob([levelJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formatToSnakeCase(levelName)}.json`;
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const importLevelFromFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const externalLevel = JSON.parse(text) as Loophole_Level;

                // Validate the external level structure
                if (externalLevel.version !== 0) {
                    alert('Invalid level version');
                    return;
                }

                // Convert external level to internal level format
                const internalLevel: Loophole_InternalLevel = {
                    ...externalLevel,
                    id: v4(),
                    updatedAt: Date.now(),
                    entrance: {
                        ...externalLevel.entrance,
                        tID: v4(),
                    },
                    explosions: externalLevel.explosions.map((explosion) => ({
                        ...explosion,
                        tID: v4(),
                    })),
                    entities: externalLevel.entities.map((entity) => ({
                        ...entity,
                        tID: v4(),
                    })),
                };

                // Add the imported level
                addLevel(internalLevel, true);
            } catch (error) {
                console.error('Failed to import level:', error);
                alert('Failed to import level. Please check the file format.');
            }
        };
        input.click();
    };

    const handleDeleteClick = () => {
        const levelCount = Object.keys(levels).length;

        // Prevent deletion if it's the only level
        if (levelCount === 1) {
            alert('Cannot delete the only level. Create a new level first.');
            return;
        }

        setShowDeleteDialog(true);
    };

    const confirmDelete = () => {
        if (!currentLevel) return;

        removeLevel(currentLevel.id);
        setShowDeleteDialog(false);
    };

    return (
        <Panel className={clsx('flex items-center w-full', className)}>
            <Input
                type="text"
                className="border-none outline-none !text-xl font-bold"
                value={name}
                placeholder={DEFAULT_LEVEL_NAME}
                onChange={(e) => updateLevel(currentLevel.id, { name: e.target.value })}
            />
            <Button variant="loophole" onClick={downloadLevel}>
                <Rocket className="size-5" />
                Test Level
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="loophole" size="icon">
                        <Paintbrush className="size-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="flex flex-col gap-2 w-64">
                    <h4 className="leading-none font-medium">Color Palette</h4>
                    <ToggleGroup
                        type="single"
                        value={currentLevel.colorPalette.toString()}
                        className="w-full"
                        onValueChange={(value) => {
                            if (value) {
                                updateLevel(currentLevel.id, {
                                    colorPalette: parseInt(value) as Loophole_ColorPalette,
                                });
                            }
                        }}
                    >
                        {Object.values(Loophole_ColorPalette).map((palette) => (
                            <ToggleGroupItem key={palette} value={palette.toString()}>
                                {palette + 1}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <img
                        src={`${COLOR_PALETTE_METADATA[currentLevel.colorPalette].image}`}
                        alt="Color Palette Screenshot"
                        className="rounded-md"
                    />
                </PopoverContent>
            </Popover>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="loophole" size="icon">
                        <Settings className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel>Level Settings</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => addLevel(createLevelWithMetadata(''), true)}>
                        <Plus /> New Level
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Upload /> Load Level
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                {Object.values(levels).length > 1 && (
                                    <>
                                        {Object.values(levels)
                                            .sort((a, b) => b.updatedAt - a.updatedAt)
                                            .map((level) =>
                                                level.id === currentLevel.id ? null : (
                                                    <DropdownMenuItem
                                                        key={level.id}
                                                        onClick={() =>
                                                            setTimeout(
                                                                () => setActiveLevelID(level.id),
                                                                100,
                                                            )
                                                        }
                                                    >
                                                        <File />{' '}
                                                        {level.name.trim() || DEFAULT_LEVEL_NAME}
                                                    </DropdownMenuItem>
                                                ),
                                            )}
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <DropdownMenuItem onClick={importLevelFromFile}>
                                    <Plus />
                                    Import From File
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            resetLevel(currentLevel.id);
                            centerCameraOnLevel();
                        }}
                    >
                        <RefreshCw /> Clear Current Level
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                        <Trash2 className="text-destructive" /> Delete Current Level
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Editor Settings</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => centerCameraOnLevel()}>
                        <Camera /> Reset Viewport
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setInterfaceHidden(true)}>
                        <AppWindow /> Hide Panels
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem
                        checked={showGrid}
                        onCheckedChange={(checked) => setUserSettings({ showGrid: checked })}
                    >
                        <Grid /> Show Grid
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={scrollDirection === -1}
                        onCheckedChange={(checked) =>
                            setUserSettings({ scrollDirection: checked ? -1 : 1 })
                        }
                    >
                        <Mouse />
                        Invert Scroll Direction
                    </DropdownMenuCheckboxItem>
                    <div className="px-2 py-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Scroll Sensitivity</span>
                            <span className="text-sm text-muted-foreground">
                                {scrollSensitivity.toFixed(1)}x
                            </span>
                        </div>
                        <Slider
                            value={[scrollSensitivity]}
                            onValueChange={([value]) =>
                                setUserSettings({ scrollSensitivity: value })
                            }
                            min={0.2}
                            max={2}
                            step={0.05}
                            className="w-full"
                        />
                    </div>
                    <DropdownMenuCheckboxItem
                        checked={showEngineStats}
                        onCheckedChange={(checked) => setUserSettings({ showEngineStats: checked })}
                    >
                        <Wrench /> Engine Stats
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Level</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{levelName}"? This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Panel>
    );
}
