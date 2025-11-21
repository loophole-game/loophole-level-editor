import { System } from '.';

export type CursorType =
    | 'default'
    | 'pointer'
    | 'crosshair'
    | 'grab'
    | 'grabbing'
    | 'move'
    | 'ew-resize' // east-west (horizontal)
    | 'ns-resize' // north-south (vertical)
    | 'nwse-resize' // northwest-southeast
    | 'nesw-resize' // northeast-southwest
    | 'not-allowed'
    | 'none';

interface CursorRequest {
    type: CursorType;
    priority: number;
}

export class CursorSystem extends System {
    #canvas: HTMLCanvasElement | null = null;
    #currentCursor: CursorType = 'default';
    #cursorRequests: Map<string, CursorRequest> = new Map();

    get currentCursor(): CursorType {
        return this.#currentCursor;
    }

    setCanvas(canvas: HTMLCanvasElement | null): void {
        this.#canvas = canvas;
        this.#applyCursor();
    }

    /**
     * Request a cursor change with a given priority.
     * Higher priority requests will take precedence.
     * @param id - Unique identifier for this request
     * @param type - The cursor type to request
     * @param priority - Priority level (default: 0, higher = more important)
     */
    requestCursor(id: string, type: CursorType, priority: number = 0): void {
        this.#cursorRequests.set(id, { type, priority });
        this.#updateCursor();
    }

    /**
     * Cancel a cursor request by its ID
     * @param id - The identifier of the request to cancel
     */
    cancelCursorRequest(id: string): void {
        this.#cursorRequests.delete(id);
        this.#updateCursor();
    }

    /**
     * Clear all cursor requests
     */
    clearAllRequests(): void {
        this.#cursorRequests.clear();
        this.#updateCursor();
    }

    destroy(): void {
        this.#cursorRequests.clear();
        if (this.#canvas) {
            this.#canvas.style.cursor = 'default';
        }
    }

    #updateCursor(): void {
        // Find the highest priority cursor request
        let highestPriority = -Infinity;
        let selectedCursor: CursorType = 'default';

        for (const request of this.#cursorRequests.values()) {
            if (request.priority > highestPriority) {
                highestPriority = request.priority;
                selectedCursor = request.type;
            }
        }

        if (this.#currentCursor !== selectedCursor) {
            this.#currentCursor = selectedCursor;
            this.#applyCursor();
        }
    }

    #applyCursor(): void {
        if (this.#canvas) {
            this.#canvas.style.cursor = this.#currentCursor;
        }
    }
}
