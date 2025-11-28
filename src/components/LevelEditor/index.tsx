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

    useEffect(() => {
        const onLevelChanged = (updatedLevel: Loophole_InternalLevel) => {
            updateLevel(level.id, {
                entities: updatedLevel.entities,
                entrance: updatedLevel.entrance,
                exitPosition: updatedLevel.exitPosition,
                explosions: updatedLevel.explosions,
            });
        };
        if (!window.engine) {
            levelEditorRef.current = new LevelEditor(onLevelChanged);
        } else {
            if (prevLevelHash.current !== levelHash) {
                levelEditorRef.current = window.engine as LevelEditor;
                levelEditorRef.current.level = level;
                prevLevelHash.current = levelHash;
            }

            if (levelEditorRef.current) {
                levelEditorRef.current.onLevelChanged = onLevelChanged;
            }
        }
    }, [activeLevelID, levelHash, level, updateLevel]);

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
                <EntityInspector className={clsx('w-fit shrink-0', panelClassName)} />
                <div
                    className={clsx('fixed bottom-4 right-4 text-right transition-opacity', {
                        'opacity-0': !showEngineStats,
                    })}
                >
                    <FPSCounter />
                </div>
            </div>
            <OpenInterfacePanel />
        </div>
    );
}
