import { useState, useEffect, useRef } from "react";
import type { TranslationManifest, BookEntry } from "../lib/scripture";

interface CommandPaletteProps {
    manifests: TranslationManifest[];
    onSelect: (profile: string, book: BookEntry, chapter: number) => void;
}

export function CommandPalette({ manifests, onSelect }: CommandPaletteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const closePalette = () => {
        setIsOpen(false);
        setQuery("");
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                closePalette();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Flatten searchable items
    const items: {
        id: string;
        translation: string;
        profile: string;
        bookName: string;
        chapterTitle: string;
        chapterNumber: number;
        book: BookEntry;
    }[] = [];

    manifests.forEach(m => {
        m.books.forEach(b => {
            b.chapters.forEach(c => {
                items.push({
                    id: `${m.profile}-${b.book_id}-${c.chapter}`,
                    translation: m.translation,
                    profile: m.profile,
                    bookName: b.name,
                    chapterTitle: c.title,
                    chapterNumber: c.chapter || 1,
                    book: b
                });
            });
        });
    });

    const exactMatch = query.toLowerCase();
    const results = query
        ? items.filter(item =>
            item.bookName.toLowerCase().includes(exactMatch) ||
            item.chapterTitle.toLowerCase().includes(exactMatch)
        ).slice(0, 20)
        : items.slice(0, 10); // Show some defaults if no query

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20" onClick={closePalette}>
            <div
                className="w-full max-w-xl overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-overlay)]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center border-b border-[var(--border-color)] px-4 py-3">
                    <span className="shell-kicker mr-3">Find</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-lg font-black uppercase tracking-[-0.04em] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-meta)]"
                        placeholder="Search books or chapters... (e.g. 'Nephi', 'Genesis')"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <kbd className="shell-button hidden sm:inline-block border-none px-0">ESC</kbd>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-secondary)]">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <ul className="py-2">
                            {results.map((item, i) => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => {
                                            onSelect(item.profile, item.book, item.chapterNumber);
                                            closePalette();
                                        }}
                                        className={`w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-white/6 ${i === 0 && query ? "bg-white/6" : ""}`}
                                    >
                                        <div>
                                            <div className="text-lg font-black uppercase tracking-[-0.04em] text-[var(--text-primary)]">{item.chapterTitle}</div>
                                            <div className="shell-meta mt-1">{item.bookName}</div>
                                        </div>
                                        <span className="shell-meta">
                                            {item.translation}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
