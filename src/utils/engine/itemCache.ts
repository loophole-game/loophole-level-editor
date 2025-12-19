type FetchUncachedItem<TValue, TKey = string> = (key: TKey) => TValue | null;

type FetchBehavior = 'always' | 'once';

export class ItemCache<TValue, TKey = string> {
    #fetchUncachedItem: FetchUncachedItem<TValue, TKey>;
    #items: Map<TKey, TValue | null> = new Map();
    #fetchBehavior: FetchBehavior;

    constructor(
        fetchUncachedItem: FetchUncachedItem<TValue, TKey>,
        fetchBehavior: FetchBehavior = 'always',
    ) {
        this.#fetchUncachedItem = fetchUncachedItem;
        this.#fetchBehavior = fetchBehavior;
    }

    get(key: TKey): TValue | null {
        if (this.#items.has(key)) {
            return this.#items.get(key)!;
        }

        const item = this.#fetchUncachedItem(key);
        if (item || this.#fetchBehavior === 'once') {
            this.#items.set(key, item);
        }

        return item;
    }
}
