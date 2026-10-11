export type Lang = "python" | "php" | "bash"

const KEYWORDS: Record<Lang, string[]> = {
    python: ["from", "import", "class", "def", "async", "await", "return", "with", "as", "if", "else", "for", "in", "not", "None", "True", "False", "self", "lambda"],
    php: ["class", "extends", "protected", "public", "function", "return", "new", "fn", "void"],
    bash: ["pip", "python", "php", "uv"],
}

const TOKEN_CLASSES = ["tk-c", "tk-s", "tk-d", "tk-k", "tk-n", "tk-t", "tk-f", "tk-v"]

const patterns = new Map<Lang, RegExp>()

function patternFor(lang: Lang): RegExp {
    const cached = patterns.get(lang)
    if (cached) return cached
    const comment = lang === "php" ? String.raw`(\/\/.*$)` : String.raw`(#.*$)`
    const pattern = new RegExp(
        [
            comment,
            String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`,
            String.raw`(@[\w.]+)`,
            String.raw`\b(${KEYWORDS[lang].join("|")})\b`,
            String.raw`\b(\d+)\b`,
            String.raw`\b([A-Z]\w*)\b`,
            String.raw`\b([a-z_][\w:]*)(?=\()`,
            String.raw`(\$\w+)`,
        ].join("|"),
        "gm",
    )
    patterns.set(lang, pattern)
    return pattern
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function highlight(code: string, lang: Lang = "python"): string {
    const pattern = patternFor(lang)
    let html = ""
    let cursor = 0
    for (const match of code.matchAll(pattern)) {
        const index = match.index ?? 0
        html += escapeHtml(code.slice(cursor, index))
        const group = match.slice(1).findIndex((value) => value !== undefined)
        html += `<span class="${TOKEN_CLASSES[group]}">${escapeHtml(match[0])}</span>`
        cursor = index + match[0].length
    }
    return html + escapeHtml(code.slice(cursor))
}
