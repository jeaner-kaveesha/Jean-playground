/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompilerFactory } from './compiler';
import wabtFactory from 'wabt';

let wabt: any = null;
wabtFactory().then(instance => {
  wabt = instance;
});

const compiler = CompilerFactory.create('jean');

self.onmessage = async (e) => {
  const { source } = e.data;
  try {
    const result = compiler.compile(source);
    
    let binary = null;
    if (wabt && result.wat && result.errors.length === 0) {
      const module = wabt.parseWat("main.wat", result.wat);
      binary = module.toBinary({ log: false, canonicalize_lebs: true, write_debug_names: true }).buffer;
    }

    self.postMessage({ 
      type: 'SUCCESS', 
      result: {
        ...result,
        wasmBinary: binary
      }
    });
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: (error as Error).message });
  }
};
