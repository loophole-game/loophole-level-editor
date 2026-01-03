import { System } from '.';

export interface LoadedImage {
    name: string;
    image: HTMLImageElement;
    owned: boolean;
}

export class ImageSystem extends System {
    #loadingImages: Set<string> = new Set();
    #loadedImages: Record<string, LoadedImage> = {};
    #pathsToLoadedImages: Record<string, string> = {};

    #requestedImages: Set<string> = new Set();
    #requestedImageJustLoaded: boolean = false;

    override lateUpdate(): boolean {
        if (this.#requestedImageJustLoaded) {
            this.#requestedImageJustLoaded = false;
            return true;
        }

        return this.#requestedImages.size > 0;
    }

    destroy(): void {
        this.#loadingImages.clear();
        this.#loadedImages = {};
        this.#requestedImages.clear();
    }

    public loadImage(name: string, src: string | HTMLImageElement): void {
        if (this.#loadedImages[name]) {
            return;
        }

        if (typeof src === 'string') {
            if (this.#loadingImages.has(name) || this.#loadedImages[name]) {
                return;
            }

            this.#loadingImages.add(name);

            const image = new Image();
            image.src = src;
            image.onload = () => {
                this.#loadedImages[name] = {
                    name,
                    image,
                    owned: true,
                };
                this.#pathsToLoadedImages[src] = name;
                this.#loadingImages.delete(name);
                if (this.#requestedImages.has(name)) {
                    this.#requestedImages.delete(name);
                    this.#requestedImageJustLoaded = true;
                }
                if (this.#requestedImages.has(src)) {
                    this.#requestedImages.delete(src);
                    this.#requestedImageJustLoaded = true;
                }
            };
            image.onerror = () => {
                this._engine.error(`Failed to load image: ${src}`);
                this.#loadingImages.delete(name);
            };
        } else {
            this.#loadedImages[name] = {
                name,
                image: src,
                owned: false,
            };
        }
    }

    public getImage(name: string): LoadedImage | null {
        const imageByName = this.#loadedImages[name];
        if (imageByName) {
            return imageByName;
        }

        const path = this.#pathsToLoadedImages[name];
        if (path) {
            const imageByPath = this.#loadedImages[path];
            if (imageByPath) {
                return imageByPath;
            }
        }

        this.#requestedImages.add(name);

        return null;
    }

    public getLoadingImages(): string[] {
        return Array.from(this.#loadingImages);
    }
}
