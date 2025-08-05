export function safeList(value: any): any[] {
    return value && Array.isArray(value) ? value : [];
}

export function isList(value: any): value is any[] {
    return value && Array.isArray(value);
}

export function safeListCopy(value: any): any[] {
    return value && Array.isArray(value) ? [...value] : [];
}