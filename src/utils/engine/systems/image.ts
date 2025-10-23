import { System } from '.';

export interface LoadedImage {
    name: string;
    image: HTMLImageElement;
    owned: boolean;
}

export class ImageSystem extends System {
    #loadingImages: Set<string> = new Set();
    #loadedImages: Record<string, LoadedImage> = {};
    #requestedImages: Set<string> = new Set();
    #requestedImageJustLoaded: boolean = false;

    update(): boolean {
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
                this.#loadingImages.delete(name);
                if (this.#requestedImages.has(name)) {
                    this.#requestedImages.delete(name);
                    this.#requestedImageJustLoaded = true;
                }
            };
            image.onerror = () => {
                console.error(`Failed to load image: ${src}`);
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
        const image = this.#loadedImages[name] || null;
        if (!image) {
            this.#requestedImages.add(name);
        }

        return image;
    }

    public getLoadingImages(): string[] {
        return Array.from(this.#loadingImages);
    }
}
