/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Web Worker for isolated WebAssembly execution.
 * This prevents intensive computations (like infinite loops) from locking up the UI thread.
 */
self.onmessage = async (e: MessageEvent) => {
  const { wasmBinary } = e.data;

  try {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const importObject = {
      env: {
        /**
         * Host function for Jean's 'say' built-in.
         * Forwards the text to the main thread for display in the console.
         */
        say: (ptr: number, len: number) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const text = new TextDecoder().decode(bytes);
          self.postMessage({ type: 'CONSOLE_LOG', text });
        },
        say_i32: (val: number) => {
          self.postMessage({ type: 'CONSOLE_LOG', text: val.toString() });
        },
        ask: (ptr: number, len: number) => {
           const bytes = new Uint8Array(memory.buffer, ptr, len);
           const promptText = new TextDecoder().decode(bytes);
           // self.postMessage can't wait for a response easily here without complex sync-comms,
           // so we'll simulate the behavior and log the request.
           self.postMessage({ type: 'CONSOLE_INPUT', prompt: promptText });
           return 0; // Length of response, handling async input is complex in wasm without suspend
        },
        log: (statePtr: number, stateLen: number, msgPtr: number, msgLen: number) => {
           const stateBytes = new Uint8Array(memory.buffer, statePtr, stateLen);
           const msgBytes = new Uint8Array(memory.buffer, msgPtr, msgLen);
           const state = new TextDecoder().decode(stateBytes).toLowerCase();
           const text = new TextDecoder().decode(msgBytes);
           self.postMessage({ type: 'DEBUG_LOG', status: state, text: `[${state.toUpperCase()}] ${text}` });
        },
        drive: async (pathPtr: number, pathLen: number, modePtr: number, modeLen: number) => {
           const pathBytes = new Uint8Array(memory.buffer, pathPtr, pathLen);
           const modeBytes = new Uint8Array(memory.buffer, modePtr, modeLen);
           const path = new TextDecoder().decode(pathBytes);
           const mode = new TextDecoder().decode(modeBytes);

           try {
               const root = await navigator.storage.getDirectory();
               if (mode === 'write') {
                   const fileHandle = await root.getFileHandle(path, { create: true });
                   const writable = await fileHandle.createWritable();
                   await writable.write("STUB_WRITTEN_DATA"); // In real impl, we'd pass data buffer
                   await writable.close();
                   self.postMessage({ type: 'CONSOLE_LOG', text: `[OPFS] Written to ${path}` });
               } else if (mode === 'read') {
                  const fileHandle = await root.getFileHandle(path);
                  const file = await fileHandle.getFile();
                  const content = await file.text();
                  self.postMessage({ type: 'CONSOLE_LOG', text: `[OPFS] Read from ${path}: ${content.slice(0, 50)}...` });
               } else {
                  self.postMessage({ type: 'CONSOLE_LOG', text: `[OPFS] Drive operation: ${mode} on ${path}` });
               }
           } catch (e) {
               self.postMessage({ type: 'DEBUG_LOG', status: 'error', text: `[OPFS ERROR] ${e}` });
           }
        },
        memory
      }
    };

    const wasmModule = await WebAssembly.instantiate(wasmBinary, importObject);
    const mainFunc = (wasmModule.instance.exports.main as Function);

    self.postMessage({ type: 'STATUS', status: 'RUNNING' });
    
    const startTime = performance.now();
    mainFunc();
    const endTime = performance.now();

    self.postMessage({ 
      type: 'STATUS', 
      status: 'FINISHED', 
      duration: endTime - startTime 
    });
  } catch (error) {
    self.postMessage({ 
      type: 'STATUS', 
      status: 'ERROR', 
      error: (error as Error).message 
    });
  }
};
