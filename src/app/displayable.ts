export type KeyHandler = (e: KeyboardEvent) => void;

function canonicalizeEventKey(e: KeyboardEvent) {
    const mods = [] as string[];
    if (e.ctrlKey) mods.push("Ctrl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Meta");
    let k = e.key;
    if (k.length === 1) k = k.toLowerCase();
    mods.push(k);
    return mods.join("-");
}

export abstract class Displayable {
    protected deleteFn?: () => void;
    private shortcuts = new Map<string, KeyHandler>();

    constructor() {
        // Attempt to install handlers shortly after construction. If `dom` is not
        // available yet, retry a few times.
        setTimeout(() => this.installHandlers(0), 0);

        // Add general shortcuts
        this.addShortcut("Alt-w", () => this.close());
        this.addShortcut("Alt--", () => this.changeWidth(-100));
        this.addShortcut("Alt-=", () => this.changeWidth(100));
    }

    setDeleteFunction(fn: () => void) {
        this.deleteFn = fn;
    }

    addShortcut(k: string, handler: KeyHandler) {
        this.shortcuts.set(k, handler);
    }

    private handleKeyEvent(e: KeyboardEvent) {
        const k = canonicalizeEventKey(e);
        const h = this.shortcuts.get(k);
        if (h) {
            if (e.type == "keydown") h(e);
            e.preventDefault();
        }
    }

    changeWidth(increment: number) {
        const w = parseInt(window.getComputedStyle(this.dom).width, 10);
        this.dom.style.width = w + increment + "px";
        this.dom.scrollIntoView();
        return true;
    }

    private installHandlers(attempt: number) {
        try {
            const root = this.dom;
            if (!root) throw new Error("no dom");

            const keyHandler = (e: KeyboardEvent) => this.handleKeyEvent(e);
            root.addEventListener("keydown", keyHandler, { capture: true });
            root.addEventListener("keyup", keyHandler, { capture: true });

            root.addEventListener("focusin", () => {
                this.dom.scrollIntoView({ behavior: "smooth" });
            });
        } catch (err) {
            if (attempt < 5) {
                setTimeout(() => this.installHandlers(attempt + 1), 50);
            } else {
                console.error("Failed to install key handlers:", err);
            }
        }
    }

    abstract focus(): void;
    abstract title(): string;
    abstract close(): boolean;
    abstract get dom(): HTMLElement;
}
