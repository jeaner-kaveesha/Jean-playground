/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service for interacting with the Origin Private File System (OPFS).
 * Provides a high-performance, persistent file system for the browser.
 */
export class OpfsService {
  private root: FileSystemDirectoryHandle | null = null;

  /**
   * Initializes the OPFS root directory handle.
   */
  async init() {
    this.root = await navigator.storage.getDirectory();
  }

  /**
   * Writes a file to OPFS.
   * @param path - The name/path of the file.
   * @param content - The content to write.
   */
  async writeFile(path: string, content: string) {
    if (!this.root) await this.init();
    const fileHandle = await this.root!.getFileHandle(path, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Reads a file from OPFS.
   * @param path - The name/path of the file.
   * @returns The file content as a string.
   */
  async readFile(path: string): Promise<string> {
    if (!this.root) await this.init();
    const fileHandle = await this.root!.getFileHandle(path);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  /**
   * Deletes a file from OPFS.
   * @param path - The name/path of the file.
   */
  async deleteFile(path: string) {
    if (!this.root) await this.init();
    await this.root!.removeEntry(path);
  }

  /**
   * Lists all files in the OPFS root.
   * @returns An array of file names.
   */
  async listFiles(): Promise<string[]> {
    if (!this.root) await this.init();
    const files: string[] = [];
    // Using entries() as it's more widely supported in TS types for FileSystemDirectoryHandle
    // @ts-ignore - Handle possible iteration typing issues in specific environments
    for await (const [name, handle] of this.root.entries()) {
      if (handle.kind === 'file') {
        files.push(name);
      }
    }
    return files;
  }
}

export const opfs = new OpfsService();
