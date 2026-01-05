import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Engine } from '../../utils/engine';
import type { PointerButton } from '../../utils/engine/systems/pointer';
import { getAppStore } from '../../utils/stores';
import type { Loophole_ExtendedEntityType } from '../../utils/levelEditor/externalLevelSchema';
import type { LevelEditor } from '../../utils/levelEditor';
import type { IVector } from '@/utils/engine/math';
import type { WebKey } from '@/utils/engine/types';

const calculateCanvasSize = (
    width: number,
    height: number,
    aspectRatio?: number,
): IVector<number> => {
    if (aspectRatio) {
        if (width / height > aspectRatio) {
            width = height * aspectRatio;
        } else {
            height = width / aspectRatio;
        }
    }
    return { x: width, y: height };
};

interface EngineCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
    engineRef: RefObject<Engine | null>;
    aspectRatio?: number;
    scrollDirection?: -1 | 1;
    scrollSensitivity?: number;
}

export function EngineCanvas({
    engineRef,
    aspectRatio,
    scrollDirection = 1,
    scrollSensitivity = 1,
    ...rest
}: EngineCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasSize, setCanvasSize] = useState<IVector<number>>(
        calculateCanvasSize(window.innerWidth, window.innerHeight, aspectRatio),
    );
    const [dpr] = useState(() => window.devicePixelRatio || 1);

    useEffect(() => {
        if (engineRef.current) {
            const onResize = () => {
                const width = window.innerWidth;
                const height = window.innerHeight;
                const newCanvasSize = calculateCanvasSize(width, height, aspectRatio);
                setCanvasSize(newCanvasSize);
            };
            window.addEventListener('resize', onResize);

            return () => {
                window.removeEventListener('resize', onResize);
            };
        }
    }, [aspectRatio, engineRef]);

    useEffect(() => {
        if (!canvasRef.current || !engineRef.current) {
            return;
        }

        const localCanvas = canvasRef.current;
        engineRef.current.canvas = localCanvas;

        const onMouseMove = (event: MouseEvent) =>
            engineRef.current?.onMouseMove('mousemove', { x: event.clientX, y: event.clientY });
        localCanvas.addEventListener('mousemove', onMouseMove);
        const onMouseWheel = (event: WheelEvent) => {
            let delta = event.deltaY * scrollDirection;
            if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
                delta = event.deltaY * 40;
            } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
                delta = event.deltaY * 100;
            }
            delta *= scrollSensitivity;
            engineRef.current?.onMouseWheel('mousewheel', { delta });
            event.preventDefault();
        };
        localCanvas.addEventListener('wheel', onMouseWheel);
        const onMouseDown = (event: MouseEvent) =>
            engineRef.current?.onMouseDown('mousedown', {
                button: event.button as PointerButton,
            });
        localCanvas.addEventListener('mousedown', onMouseDown);
        const onMouseUp = (event: MouseEvent) =>
            engineRef.current?.onMouseUp('mouseup', { button: event.button as PointerButton });
        localCanvas.addEventListener('mouseup', onMouseUp);
        const onMouseEnter = (event: MouseEvent) =>
            engineRef.current?.onMouseEnter('mouseenter', {
                target: event.target,
                x: event.clientX,
                y: event.clientY,
            });
        localCanvas.addEventListener('mouseenter', onMouseEnter);
        const onMouseLeave = (event: MouseEvent) =>
            engineRef.current?.onMouseLeave('mouseleave', {
                target: event.target,
                x: event.clientX,
                y: event.clientY,
            });
        localCanvas.addEventListener('mouseleave', onMouseLeave);
        const onMouseOver = (event: MouseEvent) =>
            engineRef.current?.onMouseOver('mouseover', {
                from: event.relatedTarget,
                to: event.target,
            });
        localCanvas.addEventListener('mouseover', onMouseOver);

        const isInputFocused = (): boolean => {
            const activeElement = document.activeElement;
            if (!activeElement) return false;

            const tagName = activeElement.tagName.toLowerCase();
            const isInput = tagName === 'input' || tagName === 'textarea';
            const isContentEditable = activeElement.hasAttribute('contenteditable');

            return isInput || isContentEditable;
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (isInputFocused()) {
                return;
            }

            if (
                engineRef.current?.onKeyDown('keydown', {
                    key: event.key as WebKey,
                    ctrl: event.ctrlKey,
                    meta: event.metaKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                })
            ) {
                event.preventDefault();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        const onKeyUp = (event: KeyboardEvent) => {
            if (isInputFocused()) {
                return;
            }

            if (
                engineRef.current?.onKeyUp('keyup', {
                    key: event.key as WebKey,
                    ctrl: event.ctrlKey,
                    meta: event.metaKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                })
            ) {
                event.preventDefault();
            }
        };
        window.addEventListener('keyup', onKeyUp);

        const onBlur = () => {
            engineRef.current?.resetAllKeyboardKeys?.();
        };
        window.addEventListener('blur', onBlur);

        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                engineRef.current?.resetAllKeyboardKeys?.();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        localCanvas.addEventListener('contextmenu', (event) => event.preventDefault());

        const onDragOver = (event: DragEvent) => {
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
        };
        localCanvas.addEventListener('dragover', onDragOver);

        const onDrop = (event: DragEvent) => {
            event.preventDefault();
            const entityType = event.dataTransfer?.getData('entityType');
            if (!entityType || !engineRef.current) {
                return;
            }

            const editor = engineRef.current as LevelEditor;
            const { setBrushEntityType } = getAppStore();
            const extendedType = entityType as Loophole_ExtendedEntityType;

            // Set the brush entity type
            setBrushEntityType(extendedType);

            // Convert drop coordinates to screen coordinates relative to canvas
            const canvasRect = localCanvas.getBoundingClientRect();
            const screenX = event.clientX - canvasRect.left;
            const screenY = event.clientY - canvasRect.top;

            // Let the engine handle the drop
            editor.handleDrop(screenX, screenY, extendedType);
        };
        localCanvas.addEventListener('drop', onDrop);

        return () => {
            localCanvas.removeEventListener('mousemove', onMouseMove);
            localCanvas.removeEventListener('wheel', onMouseWheel);
            localCanvas.removeEventListener('mousedown', onMouseDown);
            localCanvas.removeEventListener('mouseup', onMouseUp);
            localCanvas.removeEventListener('mouseenter', onMouseEnter);
            localCanvas.removeEventListener('mouseleave', onMouseLeave);
            localCanvas.removeEventListener('mouseover', onMouseOver);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            localCanvas.removeEventListener('dragover', onDragOver);
            localCanvas.removeEventListener('drop', onDrop);
        };
    }, [canvasSize, engineRef, scrollDirection, scrollSensitivity]);

    return (
        <canvas
            {...rest}
            ref={canvasRef}
            width={canvasSize.x * dpr}
            height={canvasSize.y * dpr}
            style={{ width: `${canvasSize.x}px`, height: `${canvasSize.y}px` }}
        />
    );
}
