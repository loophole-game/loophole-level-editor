import React, { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export default function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'bg-gray-800 shadow-lg rounded-sm p-2 gap-4 pointer-events-auto text-white',
                className,
            )}
            {...rest}
        ></div>
    );
}
