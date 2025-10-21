import type { Position } from './types';

export const positionsEqual = (a: Position, b: Position) => a.x === b.x && a.y === b.y;
