export function arrayEquals(a: any, b: any) {
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}

export function isString(test: any) {
    return typeof test === 'string' || test instanceof String
}

export function arrayUnique<T>(array: T[]) {
    return array.filter((v, i, a) => a.indexOf(v) === i)
}

export function regexEscape(str: string) {
    return str.toString().replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}

export function deepClone(obj: any) {
    if (window.structuredClone)
        return window.structuredClone(obj)
    return JSON.parse(JSON.stringify(obj))
}
