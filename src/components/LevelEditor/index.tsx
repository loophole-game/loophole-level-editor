import { LevelEditor } from '@/utils/levelEditor';
import { useAppStore, useSettingsStore, useCurrentLevel } from '@/utils/stores';
import { useEffect, useRef } from 'react';
import { EngineCanvas } from '../engine/EngineCanvas';
import TopPanel from './TopPanel';
import TilePicker from './TilePicker';
import { FPSCounter } from '../engine/FPSCounter';
import { LayerButtons } from './LayerButtons';
import { EntityInspector } from './EntityInspector';
import type { Loophole_InternalLevel } from '@/utils/levelEditor/externalLevelSchema';
import { COLOR_PALETTE_METADATA, Loophole_ColorPalette } from '@/utils/utils';
import clsx from 'clsx';
import { OpenInterfacePanel } from '../OpenInterfacePanel';
import { ScrollArea } from '../ui/scroll-area';
import { ResetViewportPanel } from './ResetViewportPanel';

export function LevelEditorComponent() {
    const levelEditorRef = useRef<LevelEditor | null>(null);
    const levels = useAppStore((state) => state.levels);
    const activeLevelID = useAppStore((state) => state.activeLevelID);
    const updateLevel = useAppStore((state) => state.updateLevel);
    const levelHashes = useAppStore((state) => state.levelHashes);

    const scrollDirection = useSettingsStore((state) => state.scrollDirection);
    const scrollSensitivity = useSettingsStore((state) => state.scrollSensitivity);
    const showEngineStats = useSettingsStore((state) => state.showEngineStats);
    const interfaceHidden = useAppStore((state) => state.interfaceHidden);

    const level = levels[activeLevelID];
    const levelHash = levelHashes[activeLevelID];
    const prevLevelHash = useRef<number | null>(null);
    const currentLevel = useCurrentLevel();

    const colorPaletteClass =
        COLOR_PALETTE_METADATA[
            (currentLevel?.colorPalette ||
                Loophole_ColorPalette.ONE) as keyof typeof COLOR_PALETTE_METADATA
        ]?.class;

    // Create LevelEditor synchronously during render to avoid timing issues with EngineCanvas
    // This ensures engineRef.current is set before EngineCanvas's useEffect runs
    if (!levelEditorRef.current) {
        levelEditorRef.current = new LevelEditor();
    }

    useEffect(() => {
        if (!levelEditorRef.current) return;

        // Update options when dependencies change
        levelEditorRef.current.options = {
            alwaysRender: showEngineStats,
            engineTracesEnabled: showEngineStats,
            debugOverlayEnabled: showEngineStats,
            onLevelChanged: (updatedLevel: Loophole_InternalLevel) => {
                updateLevel(level.id, {
                    entities: updatedLevel.entities,
                    entrance: updatedLevel.entrance,
                    exitPosition: updatedLevel.exitPosition,
                    explosions: updatedLevel.explosions,
                });
            },
        };

        if (prevLevelHash.current !== levelHash) {
            levelEditorRef.current.level = level;
            prevLevelHash.current = levelHash;
        }
    }, [activeLevelID, levelHash, level, updateLevel, showEngineStats]);

    const panelClassName = clsx({
        'pointer-events-auto': !interfaceHidden,
    });

    return (
        <div className={clsx('h-screen w-screen flex flex-col overflow-hidden', colorPaletteClass)}>
            <div className="fixed top-0 left-0" id="engine-canvas">
                <EngineCanvas
                    engineRef={levelEditorRef}
                    scrollDirection={scrollDirection}
                    scrollSensitivity={scrollSensitivity}
                />
            </div>
            <div
                className={clsx(
                    'h-full flex flex-col p-4 gap-4 z-10 pointer-events-none transition-all',
                    {
                        'scale-125 opacity-0': interfaceHidden,
                    },
                )}
            >
                <TopPanel className={panelClassName} />
                <div className="flex-1 flex flex-col gap-4 max-w-54 min-h-0">
                    <TilePicker className={panelClassName} />
                    <ScrollArea className="flex-1 min-h-0">
                        <LayerButtons groupClassName={panelClassName} />
                    </ScrollArea>
                </div>
                <EntityInspector
                    editorRef={levelEditorRef}
                    className={clsx('w-fit shrink-0 z-10', panelClassName)}
                />
                <div
                    className={clsx(
                        'fixed bottom-0 right-0 text-right transition-opacity p-2 bg-linear-to-br from-black/5 to-black/70 rounded-tl-lg',
                        {
                            'opacity-0': !showEngineStats,
                        },
                    )}
                >
                    <FPSCounter editorRef={levelEditorRef} />
                </div>
            </div>
            <OpenInterfacePanel />
            <ResetViewportPanel />
        </div>
    );
}
