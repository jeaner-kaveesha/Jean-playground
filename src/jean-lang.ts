/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamLanguage } from '@codemirror/language';
import { JEAN_KEYWORDS, JEAN_OPERATORS, JEAN_SEPARATORS } from './types';

export const jeanLanguage = StreamLanguage.define({
  token: (stream) => {
    if (stream.eatSpace()) return null;

    if (stream.match('##')) {
      while (!stream.eol()) {
        if (stream.match('##')) break;
        stream.next();
      }
      return 'comment';
    }

    if (stream.match('#')) {
      stream.skipToEnd();
      return 'comment';
    }

    if (stream.match('"')) {
      while (!stream.eol() && stream.next() !== '"');
      return 'string';
    }

    if (stream.match(/[0-9]+/)) {
      return 'number';
    }

    for (const kw of JEAN_KEYWORDS) {
      if (stream.match(new RegExp(`\\b${kw}\\b`))) return 'keyword';
    }

    for (const op of JEAN_OPERATORS) {
      const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (stream.match(new RegExp(`${escapedOp}`))) return 'operator';
    }

    for (const sep of JEAN_SEPARATORS) {
      const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (stream.match(new RegExp(`${escapedSep}`))) return 'punctuation';
    }

    if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return 'variableName';
    }

    stream.next();
    return null;
  }
});
