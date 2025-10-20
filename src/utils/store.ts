import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createLevelWithMetadata, type LevelWithMetadata } from './utils';
import type { Loophole_ExtendedEntityType } from './editor/externalLevelSchema';
import { useMemo } from 'react';

interface AppStore {
    levels: Record<string, LevelWithMetadata>;
    activeLevelID: string | null;
    addLevel: (level: LevelWithMetadata) => void;
    setActiveLevelID: (levelID: string) => void;
    removeLevel: (levelID: string) => void;
    updateLevel: (level: LevelWithMetadata) => void;
    selectedEntityType: Loophole_ExtendedEntityType | null;
    setSelectedEntityType: (entityType: Loophole_ExtendedEntityType) => void;
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
                updateLevel: (level) =>
                    set((state) => ({
                        levels: Object.fromEntries(
                            Object.entries(state.levels).map(([id, l]) => [
                                id,
                                l.id === level.id ? level : l,
                            ]),
                        ),
                    })),
                selectedEntityType: null,
                setSelectedEntityType: (entityType) => set({ selectedEntityType: entityType }),
            };
        },
        {
            name: 'app-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                levels: state.levels,
                activeLevelID: state.activeLevelID,
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
