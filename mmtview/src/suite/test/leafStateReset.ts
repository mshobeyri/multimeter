export type LeafStateReset = 'all' | readonly string[];

export function resetLeafStateMap<T>(state: Record<string, T>, reset: LeafStateReset): Record<string, T> {
    if (reset === 'all') {
        return {};
    }
    if (!Array.isArray(reset) || reset.length === 0) {
        return state;
    }

    let next: Record<string, T> | null = null;
    for (const id of reset) {
        if (!id || !Object.prototype.hasOwnProperty.call(state, id)) {
            continue;
        }
        if (!next) {
            next = { ...state };
        }
        delete next[id];
    }

    return next || state;
}
