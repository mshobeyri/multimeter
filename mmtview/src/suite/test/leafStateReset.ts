export type LeafStateReset = 'all' | readonly string[];

export function resetLeafStateMap<T>(state: Record<string, T>, reset: LeafStateReset): Record<string, T> {
    if (reset === 'all') {
        return {};
    }
    if (!Array.isArray(reset) || reset.length === 0) {
        return state;
    }

    let next: Record<string, T> | null = null;
    for (const leafId of reset) {
        if (!leafId || !Object.prototype.hasOwnProperty.call(state, leafId)) {
            continue;
        }
        if (!next) {
            next = { ...state };
        }
        delete next[leafId];
    }

    return next || state;
}
