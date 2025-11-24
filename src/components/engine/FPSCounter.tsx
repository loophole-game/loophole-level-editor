import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface FPSCounterProps {
    className?: string;
}

interface EngineStats {
    fps: number;
    updateTime: number;
    renderTime: number;
    commandCount: number;
    drawCallCount: number;
}

export function FPSCounter({ className }: FPSCounterProps) {
    const [stats, setStats] = useState<EngineStats>({
        fps: 0,
        updateTime: 0,
        renderTime: 0,
        commandCount: 0,
        drawCallCount: 0,
    });
    useEffect(() => {
        const interval = setInterval(() => {
            if (window.engine) {
                setStats({
                    fps: window.engine.fps,
                    updateTime: window.engine.updateTime,
                    renderTime: window.engine.renderTime,
                    commandCount: window.engine.renderCommandCount,
                    drawCallCount: window.engine.renderDrawCallCount,
                });
            }
        }, 200);

        return () => clearInterval(interval);
    }, []);

    return (
        <p className={cn('text-white text-xs', className)}>
            FPS: {stats.fps}
            <br />
            Update: {stats.updateTime.toFixed(1)}ms
            <br />
            Render: {stats.renderTime >= 0 ? `${stats.renderTime.toFixed(1)}ms` : 'N/A'}
            <br />
            Commands: {stats.commandCount}
            <br />
            Draw Calls: {stats.drawCallCount}
        </p>
    );
}
