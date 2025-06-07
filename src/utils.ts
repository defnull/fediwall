export function arrayEquals(a: any, b: any) {
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}

export function isString(test: any) {
    return typeof test === 'string' || test instanceof String
}

export function notBlank(test?: string) {
    return test && test.trim().length > 0
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

export async function sleep(ms: number) {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}


/**
 * Find all text nodes and replace each occurrences of a pattern with either
 * a string or a new DOM node. Can be used to replace emojis with images or
 * URLs with links.
 * 
 * The root node is modified in-place and also returned.
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

export function whack(what:string, how_much: number) {
    const rand = (scale:number) => (Math.random() * 2 - 1) * scale * how_much;
    document
        .querySelectorAll(what)
        .forEach((node) => {
            if(node instanceof HTMLElement)
                node.style.transform = how_much > 0 ? `translate(${rand(4)}px, ${rand(4)}px) rotate(${rand(1)}deg)` : ""
        })
}