import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createLevelWithMetadata, getLoopholeEntityExtendedType } from './utils';
import type {
    Loophole_ExtendedEntityType,
    Loophole_InternalLevel,
    Loophole_Rotation,
} from './levelEditor/externalLevelSchema';
import { useMemo } from 'react';
import type { E_Tile } from './levelEditor/scenes/grid';
import { isMac } from './engine/utils';
import type { CameraData } from './engine/types';

interface AppStore {
    levels: Record<string, Loophole_InternalLevel>;
    levelHashes: Record<string, number>;
    activeLevelID: string;
    addLevel: (level: Loophole_InternalLevel) => void;
    setActiveLevelID: (levelID: string) => void;
    removeLevel: (levelID: string) => void;
    updateLevel: (
        id: string,
        level: Partial<Loophole_InternalLevel>,
        sendToEditor?: boolean,
    ) => void;
    resetLevel: (id: string) => void;

    brushEntityType: Loophole_ExtendedEntityType | null;
    setBrushEntityType: (entityType: Loophole_ExtendedEntityType | null) => void;
    brushEntityRotation: Loophole_Rotation;
    setBrushEntityRotation: (rotation: Loophole_Rotation) => void;
    brushEntityFlipDirection: boolean;
    setBrushEntityFlipDirection: (direction: boolean) => void;

    selectedTiles: Record<string, E_Tile>;
    setSelectedTiles: (tiles: E_Tile[]) => void;
    deselectEntities: (tileIDs: string[]) => void;

    isMovingTiles: boolean;
    setIsMovingTiles: (isMoving: boolean) => void;
    isDraggingToPlace: boolean;
    setIsDraggingToPlace: (isDraggingToPlace: boolean) => void;

    lockedLayers: Partial<Record<Loophole_ExtendedEntityType, boolean>>;
    setLockedLayer: (layer: Loophole_ExtendedEntityType, locked: boolean) => void;

    editableLayers: Loophole_ExtendedEntityType[];
    setEditableLayers: (layers: Loophole_ExtendedEntityType[]) => void;
    addEditableLayer: (layer: Loophole_ExtendedEntityType) => void;
    removeEditableLayer: (layer: Loophole_ExtendedEntityType) => void;

    cameraTarget: CameraData | null;
    setCameraTarget: (cameraTarget: CameraData | null) => void;
}

export const useAppStore = create<AppStore>()(
    persist(
        (set) => {
            const defaultLevel = createLevelWithMetadata('');

            return {
                levels: {
                    [defaultLevel.id]: defaultLevel,
                },
                levelHashes: {
                    [defaultLevel.id]: Math.random(),
                },
                activeLevelID: defaultLevel.id,
                addLevel: (level) =>
                    set((state) => ({
                        levels: { ...state.levels, [level.id]: level },
                        levelHashes: { ...state.levelHashes, [level.id]: Math.random() },
                    })),
                setActiveLevelID: (levelID: string) => set({ activeLevelID: levelID }),
                removeLevel: (levelID: string) =>
                    set((state) => ({
                        levels: Object.fromEntries(
                            Object.entries(state.levels).filter(([id]) => id !== levelID),
                        ),
                    })),
                updateLevel: (id, level, sendToEditor = false) => {
                    set((state) => ({
                        levels: Object.fromEntries(
                            Object.entries(state.levels).map(([currID, l]) => [
                                currID,
                                currID === id ? { ...l, ...level } : l,
                            ]),
                        ),
                        levelHashes: {
                            ...state.levelHashes,
                            [id]: sendToEditor ? Math.random() : state.levelHashes[id],
                        },
                    }));
                },
                resetLevel: (id) => {
                    set((state) => ({
                        levels: {
                            ...state.levels,
                            [id]: createLevelWithMetadata(state.levels[id].name ?? '', id),
                        },
                        levelHashes: { ...state.levelHashes, [id]: Math.random() },
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
                    set((state) => {
                        const filteredTiles = tiles.filter(
                            (t) => !state.lockedLayers[getLoopholeEntityExtendedType(t.entity)],
                        );
                        return {
                            selectedTiles: Object.fromEntries(
                                filteredTiles.map((t) => [t.entity.tID, t]),
                            ),
                        };
                    });
                },
                deselectEntities: (tileIDs) =>
                    set((state) => {
                        const newSelectedTiles = { ...state.selectedTiles };
                        for (const tID of tileIDs) {
                            delete newSelectedTiles[tID];
                        }
                        return { selectedTiles: newSelectedTiles };
                    }),

                isMovingTiles: false,
                setIsMovingTiles: (isMoving) => set({ isMovingTiles: isMoving }),
                isDraggingToPlace: false,
                setIsDraggingToPlace: (isDraggingToPlace) =>
                    set({ isDraggingToPlace: isDraggingToPlace }),

                lockedLayers: {},
                setLockedLayer: (layer, locked) =>
                    set((state) => ({ lockedLayers: { ...state.lockedLayers, [layer]: locked } })),

                editableLayers: ['SAUCE', 'WIRE'],
                setEditableLayers: (layers) => set({ editableLayers: layers }),
                addEditableLayer: (layer) =>
                    set((state) => ({
                        editableLayers: state.editableLayers.includes(layer)
                            ? state.editableLayers
                            : [...state.editableLayers, layer],
                    })),
                removeEditableLayer: (layer) =>
                    set((state) => ({
                        editableLayers: state.editableLayers.filter((l) => l !== layer),
                        lockedLayers: { ...state.lockedLayers, [layer]: false },
                    })),

                cameraTarget: null,
                setCameraTarget: (cameraTarget) => set({ cameraTarget }),
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
                lockedLayers: state.lockedLayers,
                editableLayers: state.editableLayers,
            }),
            version: 3,
            migrate: () => {},
        },
    ),
);

export const useCurrentLevel = (): Loophole_InternalLevel | null => {
    const activeLevelID = useAppStore((state) => state.activeLevelID);
    const levels = useAppStore((state) => state.levels);

    return useMemo(() => levels[activeLevelID ?? ''] || null, [activeLevelID, levels]);
};

export const getAppStore = () => useAppStore.getState();

interface UserSettings {
    scrollDirection: -1 | 1;
    showEngineStats: boolean;
    scrollSensitivity: number;
    showGrid: boolean;
}

interface SettingsStore extends UserSettings {
    setUserSettings: (settings: Partial<UserSettings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => {
            return {
                scrollDirection: isMac ? -1 : 1,
                showEngineStats: false,
                scrollSensitivity: 1,
                showGrid: true,

                setUserSettings: (settings) => set({ ...settings }),
            };
        },
        {
            name: 'settings-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ ...state }),
            version: 1,
            migrate: () => {},
        },
    ),
);

export const getSettingsStore = () => useSettingsStore.getState();