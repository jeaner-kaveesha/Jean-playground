/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents the type of a lexical token.
 */
export enum TokenType {
  /** A reserved language keyword */
  KEYWORD = 'KEYWORD',
  /** A user-defined name */
  IDENTIFIER = 'IDENTIFIER',
  /** A mathematical or logical operator */
  OPERATOR = 'OPERATOR',
  /** A string literal */
  STRING = 'STRING',
  /** A numerical literal */
  NUMBER = 'NUMBER',
  /** A boolean literal (true/false) */
  BOOLEAN = 'BOOLEAN',
  /** A structural character (e.g., brackets, commas) */
  SEPARATOR = 'SEPARATOR',
  /** End of file marker */
  EOF = 'EOF',
  /** An unrecognized character */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Represents a single token produced by the lexer.
 */
export interface Token {
  /** The specific type of the token */
  type: TokenType;
  /** The raw text value of the token */
  value: string;
  /** The line number where it appears (1-indexed) */
  line: number;
  /** The column number where it starts (1-indexed) */
  column: number;
}

/**
 * Reserved keywords in the Jean language.
 */
export const JEAN_KEYWORDS = [
  'public', 'import', 'let', 'mut', 'def', 'type', 'impl', 'with', 'if', 'else', 'exit', 'pass', 'return', 'defer', 'while', 'yeild', 'eval', 'as', 'is', 'in', 'say', 'ask', 'log', 'asm', 'drive'
];

/**
 * Valid operators in the Jean language.
 */
export const JEAN_OPERATORS = [
  '+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', 'and', 'or', 'not', 'xor', '<<', '>>', '=', '&', '?', '=>'
];

/**
 * Valid separators in the Jean language.
 */
export const JEAN_SEPARATORS = [
  '.', ',', ':', '(', ')', '{', '}', '[', ']', '#'
];

/**
 * Represents a file or folder in the project's virtual file system.
 */
export interface FileEntry {
  /** The display name of the entry */
  name: string;
  /** The raw code or text content */
  content: string;
  /** The file extension (without dot) */
  extension: string;
  /** Unique identifier for the entry */
  id: string;
  /** ID of the parent folder, or null if root */
  parentId: string | null;
  /** Whether this is a file or a folder */
  type: 'file' | 'folder';
}

/**
 * Result returned by the Jean compiler.
 */
export interface CompilerResult {
  /** The generated WebAssembly Text (WAT) source */
  wat: string;
  /** The compiled WebAssembly binary (nullable if errors exist) */
  wasm: Uint8Array | null;
  /** List of compiler errors encountered */
  errors: string[];
  /** The abstract syntax tree in JSON format */
  ast?: any;
}
