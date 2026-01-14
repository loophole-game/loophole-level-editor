import {
    AppWindow,
    Camera,
    File,
    Grid,
    Keyboard,
    Mouse,
    Plus,
    RefreshCw,
    Settings,
    Trash2,
    Upload,
    UploadCloud,
    Wrench,
} from 'lucide-react';
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
import { Button } from '../ui/button';
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
import { useAppStore, useCurrentLevel, useSettingsStore } from '@/utils/stores';
import { useState } from 'react';
import { createLevelWithMetadata, DEFAULT_LEVEL_NAME } from '@/utils/utils';
import type {
    Loophole_InternalLevel,
    Loophole_Level,
} from '@/utils/levelEditor/externalLevelSchema';
import { v4 } from 'uuid';
import { Slider } from '../ui/slider';

interface SettingsDropdownProps {
    levelName: string;
}

export function SettingsDropdown({ levelName }: SettingsDropdownProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const levels = useAppStore((state) => state.levels);
    const currentLevel = useCurrentLevel();
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
    const showKeybindings = useSettingsStore((state) => state.showKeybindings);
    const setUserSettings = useSettingsStore((state) => state.setUserSettings);

    if (!currentLevel) return null;

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
                // eslint-disable-next-line no-console
                console.error('Failed to import level:', error);
                alert('Failed to import level.');
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
        <>
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
                    <DropdownMenuLabel>Quick Links</DropdownMenuLabel>
                    <a
                        href="https://github.com/loophole-game/community-levels-guide"
                        target="_blank"
                    >
                        <DropdownMenuItem>
                            <UploadCloud /> Publishing Guide
                        </DropdownMenuItem>
                    </a>
                    <a href="https://steamcommunity.com/app/3629400/workshop/" target="_blank">
                        <DropdownMenuItem>
                            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <title>Steam</title>
                                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
                            </svg>
                            Steam Workshop
                        </DropdownMenuItem>
                    </a>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Viewport Settings</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => centerCameraOnLevel()}>
                        <Camera /> Fit to Content
                    </DropdownMenuItem>
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
                        checked={scrollDirection === -1}
                        onCheckedChange={(checked) =>
                            setUserSettings({ scrollDirection: checked ? -1 : 1 })
                        }
                    >
                        <Mouse />
                        Invert Scroll Direction
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Editor Settings</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                        checked={showKeybindings}
                        onCheckedChange={(checked) => setUserSettings({ showKeybindings: checked })}
                    >
                        <Keyboard /> Keybindings Panel
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked onClick={() => setInterfaceHidden(true)}>
                        <AppWindow /> UI Panels
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={showGrid}
                        onCheckedChange={(checked) => setUserSettings({ showGrid: checked })}
                    >
                        <Grid /> Grid
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={showEngineStats}
                        onCheckedChange={(checked) => setUserSettings({ showEngineStats: checked })}
                    >
                        <Wrench /> Debug Stats
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
        </>
    );
}
