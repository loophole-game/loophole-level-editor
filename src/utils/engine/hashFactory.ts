type HashFunction<T> = (item: T) => string;

interface HashedItem<T> {
    id: number;
    value: T;
}

export class HashFactory<T> {
    protected static _nextId: number = 1;

    #hashFunction: HashFunction<T>;

    #itemsByHash: Map<string, HashedItem<T>> = new Map();
    #itemsByID: Map<number, HashedItem<T>> = new Map();

    constructor(hashFunction: HashFunction<T>) {
        this.#hashFunction = hashFunction;
    }

    size(): number {
        return this.#itemsByID.size;
    }

    idToItem(id: number): HashedItem<T> | null {
        return this.#itemsByID.get(id) ?? null;
    }

    hashToItem(hash: string): HashedItem<T> | null {
        return this.#itemsByHash.get(hash) ?? null;
    }

    itemToID(item: T): number {
        const hash = this.#hashFunction(item);
        if (this.#itemsByHash.has(hash)) {
            return this.#itemsByHash.get(hash)!.id;
        }

        const hashedItem: HashedItem<T> = { id: HashFactory._nextId++, value: item };
        this.#itemsByHash.set(hash, hashedItem);
        this.#itemsByID.set(hashedItem.id, hashedItem);

        return hashedItem.id;
    }
}
