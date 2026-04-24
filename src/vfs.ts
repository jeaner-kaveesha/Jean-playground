/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileEntry } from './types';
import JSZip from 'jszip';
import { opfs } from './services/opfs';

/**
 * Utility function to export the current project as a ZIP archive.
 * @param files - Array of file entries to include.
 */
export const exportAsZip = async (files: FileEntry[]) => {
  const zip = new JSZip();
  files.forEach(file => {
    if (file.type === 'file') {
      zip.file(file.name, file.content);
    }
  });
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jean_project.zip';
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Manages the state and operations of the project's file system.
 * Handles persistence via OPFS and in-memory synchronization.
 */
export class VirtualFileSystem {
  private files: FileEntry[] = [
    {
      id: 'root-main',
      name: 'main.je',
      extension: 'je',
      content: `## 
   Jean Programming Language - v0.7
##

# Hello World! 
say("Hello World!")

# Built-in: ask
# Currently simulates a prompt and logs debug info
ask("What is your mission?")

# Built-in: log
log("success", "Engine started successfully")
log("info", "Checking subsystems...")
log("warn", "Fuel low (simulated)")

# Built-in: drive
drive("/usr/bin", "exec")

# Built-in: asm
# Injects raw instructions
asm("(i32.const 42) (drop)")

# Control Flow & Variables
let mut i = 0
while i < 3:
    say("Cycle count:")
    say(i)
    i = i + 1

log("success", "Operation Complete")
`,
      parentId: null,
      type: 'file'
    }
  ];

  /**
   * Initializes the VFS by loading persisted data from OPFS.
   */
  public async init() {
    try {
      const persistedFiles = await opfs.listFiles();
      if (persistedFiles.length > 0) {
        // Simple mapping for this exercise: we load the first file found or restore from basic structure
        // In a full app, we'd store a manifest.json in OPFS.
      }
    } catch (e) {
      console.warn("OPFS init failed, falling back to memory.", e);
    }
  }

  /**
   * Retrieves all current file entries.
   */
  public getFiles(): FileEntry[] {
    return [...this.files];
  }

  /**
   * Overwrites the current file set.
   * @param files - New set of file entries.
   */
  public setFiles(files: FileEntry[]): void {
    this.files = [...files];
  }

  /**
   * Finds a file by its unique ID.
   * @param id - The file identifier.
   */
  public getFile(id: string): FileEntry | undefined {
    return this.files.find(f => f.id === id);
  }

  /**
   * Updates the content of a specific file and persists it.
   * @param id - The file identifier.
   * @param content - New code content.
   */
  public updateFile(id: string, content: string): void {
    const file = this.files.find(f => f.id === id);
    if (file) {
      file.content = content;
      // Background persistence
      opfs.writeFile(file.id, content).catch(console.error);
    }
  }

  /**
   * Renames a file entry.
   * @param id - The file identifier.
   * @param newName - The new display name.
   */
  public renameFile(id: string, newName: string): void {
    const file = this.files.find(f => f.id === id);
    if (file) {
      file.name = newName;
      file.extension = newName.split('.').pop() || '';
    }
  }

  /**
   * Removes a file from the system.
   * @param id - The file identifier.
   */
  public removeFile(id: string): void {
    this.files = this.files.filter(f => f.id !== id);
    opfs.deleteFile(id).catch(() => {});
  }

  /**
   * Creates a new file or folder entry.
   * @param name - Entry name.
   * @param parentId - Parent folder ID.
   * @param type - Type of entry ('file' or 'folder').
   */
  public createFile(name: string, parentId: string | null = null, type: 'file' | 'folder' = 'file'): FileEntry {
    const newFile: FileEntry = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      extension: name.split('.').pop() || '',
      content: '',
      parentId,
      type
    };
    this.files.push(newFile);
    return newFile;
  }
}

/**
 * Singleton factory for retrieving the VirtualFileSystem instance.
 */
export class VFSFactory {
  private static instance: VirtualFileSystem;
  static getInstance() {
    if (!this.instance) this.instance = new VirtualFileSystem();
    return this.instance;
  }
}
