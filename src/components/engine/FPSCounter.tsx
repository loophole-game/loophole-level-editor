import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface FPSCounterProps {
    className?: string;
}

export function FPSCounter({ className }: FPSCounterProps) {
    const [stats, setStats] = useState<{ fps: number; updateTime: number; renderTime: number }>({
        fps: 0,
        updateTime: 0,
        renderTime: 0,
    });
    useEffect(() => {
        const interval = setInterval(() => {
            if (window.engine) {
                setStats({
                    fps: window.engine.fps,
                    updateTime: window.engine.updateTime,
                    renderTime: window.engine.renderTime,
                });
            }
        }, 200);

        return () => clearInterval(interval);
    }, []);

    return (
        <p className={cn('text-white', className)}>
            FPS: {stats.fps}
            <br />
            Update: {stats.updateTime.toFixed(1)}ms
            <br />
            Render: {stats.renderTime >= 0 ? `${stats.renderTime.toFixed(1)}ms` : 'N/A'}
        </p>
    );
}
