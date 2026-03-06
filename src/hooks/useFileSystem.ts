import { useState, useCallback } from 'react';

// File System Access API types (not yet in all TS libs)
declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
  }
}

export function useFileSystem() {
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [error, setError] = useState<string | null>(null);

    const requestAccess = useCallback(async () => {
        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });
            setDirectoryHandle(handle);
            setError(null);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError(err.message || 'Failed to get directory access.');
            }
        }
    }, []);

    const saveFile = useCallback(async (filename: string, content: string) => {
        if (!directoryHandle) {
            throw new Error('No directory selected');
        }

        try {
            // Get a reference to the file
            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });

            // Create a FileSystemWritableFileStream to write to
            const writable = await fileHandle.createWritable();

            // Write the contents of the file to the stream
            await writable.write(content);

            // Close the file
            await writable.close();
        } catch (err: any) {
            console.error('Failed to save file:', err);
            throw err;
        }
    }, [directoryHandle]);

    const readFile = useCallback(async (filename: string): Promise<string | null> => {
        if (!directoryHandle) return null;

        try {
            const fileHandle = await directoryHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (err: any) {
            if (err.name === 'NotFoundError') {
                return null;
            }
            console.error('Failed to read file:', err);
            throw err;
        }
    }, [directoryHandle]);

    return {
        directoryHandle,
        isReady: !!directoryHandle,
        error,
        requestAccess,
        saveFile,
        readFile
    };
}
