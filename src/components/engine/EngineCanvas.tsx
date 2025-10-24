import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Engine } from '../../utils/engine';
import type { Position } from '../../utils/engine/types';
import type { PointerButton } from '../../utils/engine/systems/pointer';

const calculateCanvasSize = (width: number, height: number, aspectRatio?: number): Position => {
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
}

export function EngineCanvas({ engineRef, aspectRatio, ...rest }: EngineCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasSize, setCanvasSize] = useState<Position>(
        calculateCanvasSize(window.innerWidth, window.innerHeight, aspectRatio),
    );

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
        if (canvasRef.current && engineRef.current) {
            const localCanvas = canvasRef.current;
            engineRef.current.canvas = localCanvas;

            const onMouseMove = (event: MouseEvent) =>
                engineRef.current?.onMouseMove('mousemove', { x: event.clientX, y: event.clientY });
            localCanvas.addEventListener('mousemove', onMouseMove);
            const onMouseWheel = (event: WheelEvent) => {
                engineRef.current?.onMouseWheel('mousewheel', { delta: event.deltaY });
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

            const onKeyDown = (event: KeyboardEvent) =>
                engineRef.current?.onKeyDown('keydown', { key: event.key });
            window.addEventListener('keydown', onKeyDown);
            const onKeyUp = (event: KeyboardEvent) =>
                engineRef.current?.onKeyUp('keyup', { key: event.key });
            window.addEventListener('keyup', onKeyUp);

            localCanvas.addEventListener('contextmenu', (event) => event.preventDefault());

            return () => {
                if (!localCanvas) {
                    return;
                }

                localCanvas.removeEventListener('mousemove', onMouseMove);
                localCanvas.removeEventListener('wheel', onMouseWheel);
                localCanvas.removeEventListener('mousedown', onMouseDown);
                localCanvas.removeEventListener('mouseup', onMouseUp);
                localCanvas.removeEventListener('mouseenter', onMouseEnter);
                localCanvas.removeEventListener('mouseleave', onMouseLeave);
                localCanvas.removeEventListener('mouseover', onMouseOver);
            };
        }
    }, [canvasSize, engineRef]);

    return <canvas {...rest} ref={canvasRef} width={canvasSize.x} height={canvasSize.y} />;
}
