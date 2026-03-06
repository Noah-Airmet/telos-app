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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            setQuery("");
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
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
            <div
                className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-400 mr-3 opacity-70">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-lg outline-none text-[var(--text-primary)] placeholder-gray-400"
                        placeholder="Search books or chapters... (e.g. 'Nephi', 'Genesis')"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <kbd className="hidden sm:inline-block text-xs font-sans px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">ESC</kbd>
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
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${i === 0 && query ? "bg-gray-50 dark:bg-gray-800" : ""}`}
                                    >
                                        <div>
                                            <div className="font-medium text-[var(--text-primary)]">{item.chapterTitle}</div>
                                            <div className="text-xs text-[var(--text-secondary)] mt-0.5">{item.bookName}</div>
                                        </div>
                                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] rounded-full">
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
