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


/**
 * Find all text nodes and replace each occuences of a pattern with either
 * a string or a new DOM node. Can be used to replace emojis with images or
 * URLs with links.
 * 
 * The root node is modifed in-place and also returned.
 */
export function replaceInText(root: Node, pattern: RegExp, replace: (m: RegExpMatchArray) => string | Node) {
    const walk = (node: Node) => {
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                if (!child.nodeValue) continue;
                const text = child.nodeValue
                const matches = Array.from(text.matchAll(pattern))
                if (!matches.length) continue

                const newChilds: (string | Node)[] = []
                var lastEnd = 0
                for (const m of matches) {
                    if (m.index && m.index > lastEnd)
                        newChilds.push(text.substring(lastEnd, m.index))
                    lastEnd = (m.index || 0) + m[0].length
                    newChilds.push(replace(m))
                }
                if (lastEnd < text.length)
                    newChilds.push(text.substring(lastEnd))
                child.replaceWith(...newChilds);
            } else {
                walk(child);
            }
        }
    }

    walk(root)
    return root;
}