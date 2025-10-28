import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createLevelWithMetadata, type LevelWithMetadata } from './utils';
import type {
    Loophole_ExtendedEntityType,
    Loophole_Rotation,
} from './levelEditor/externalLevelSchema';
import { useMemo } from 'react';
import type { E_Tile } from './levelEditor/scenes/grid';

interface AppStore {
    levels: Record<string, LevelWithMetadata>;
    activeLevelID: string;
    addLevel: (level: LevelWithMetadata) => void;
    setActiveLevelID: (levelID: string) => void;
    removeLevel: (levelID: string) => void;
    updateLevel: (level: Partial<LevelWithMetadata>) => void;

    brushEntityType: Loophole_ExtendedEntityType | null;
    setBrushEntityType: (entityType: Loophole_ExtendedEntityType | null) => void;
    brushEntityRotation: Loophole_Rotation;
    setBrushEntityRotation: (rotation: Loophole_Rotation) => void;
    brushEntityFlipDirection: boolean;
    setBrushEntityFlipDirection: (direction: boolean) => void;

    selectedTiles: Record<string, E_Tile>;
    setSelectedTiles: (tiles: Record<string, E_Tile>) => void;
    multiselectHoveredTiles: Record<string, E_Tile>;
    setMultiselectHoveredTiles: (tiles: Record<string, E_Tile>) => void;
}

export const useAppStore = create<AppStore>()(
    persist(
        (set) => {
            const defaultLevel = createLevelWithMetadata('');

            return {
                levels: {
                    [defaultLevel.id]: defaultLevel,
                },
                activeLevelID: defaultLevel.id,
                addLevel: (level) =>
                    set((state) => ({ levels: { ...state.levels, [level.id]: level } })),
                setActiveLevelID: (levelID: string) => set({ activeLevelID: levelID }),
                removeLevel: (levelID: string) =>
                    set((state) => ({
                        levels: Object.fromEntries(
                            Object.entries(state.levels).filter(([id]) => id !== levelID),
                        ),
                    })),
                updateLevel: (level) => {
                    set((state) => ({
                        levels: Object.fromEntries(
                            Object.entries(state.levels).map(([id, l]) => [
                                id,
                                l.id === level.id ? { ...l, ...level } : l,
                            ]),
                        ),
                    }));
                },

                brushEntityType: null,
                setBrushEntityType: (entityType) => set({ brushEntityType: entityType }),
                brushEntityRotation: 'RIGHT',
                setBrushEntityRotation: (rotation) => set({ brushEntityRotation: rotation }),
                brushEntityFlipDirection: false,
                setBrushEntityFlipDirection: (direction) =>
                    set({ brushEntityFlipDirection: direction }),

                selectedTiles: {},
                setSelectedTiles: (tiles) => {
                    set({ selectedTiles: tiles });
                },
                multiselectHoveredTiles: {},
                setMultiselectHoveredTiles: (tiles) => {
                    set({ multiselectHoveredTiles: tiles });
                },
            };
        },
        {
            name: 'app-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                levels: state.levels,
                activeLevelID: state.activeLevelID,
                brushEntityType: state.brushEntityType,
                brushEntityRotation: state.brushEntityRotation,
                brushEntityFlipDirection: state.brushEntityFlipDirection,
            }),
            version: 1,
            migrate: () => {},
        },
    ),
);

export const useCurrentLevel = (): LevelWithMetadata | null => {
    const activeLevelID = useAppStore((state) => state.activeLevelID);
    const levels = useAppStore((state) => state.levels);

    return useMemo(() => levels[activeLevelID ?? ''] || null, [activeLevelID, levels]);
};

export const getAppStore = () => useAppStore.getState();
