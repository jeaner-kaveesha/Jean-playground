/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenType, Token, JEAN_KEYWORDS, JEAN_OPERATORS, JEAN_SEPARATORS } from './types';

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    return this.input[this.pos] || '';
  }

  private advance(): string {
    const char = this.peek();
    this.pos++;
    if (char === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return char;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const char = this.peek();

      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      if (char === '#') {
        this.advance(); // consume first #
        if (this.peek() === '#') {
          this.advance(); // consume second #
          while (this.peek()) {
            if (this.peek() === '#' && this.input[this.pos + 1] === '#') {
              this.advance();
              this.advance();
              break;
            }
            this.advance();
          }
        } else {
          while (this.peek() && this.peek() !== '\n') this.advance();
        }
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (char === '"') {
        tokens.push(this.readString());
        continue;
      }

      // Operators and Separators
      const twoCharOp = char + (this.input[this.pos + 1] || '');
      if (JEAN_OPERATORS.includes(twoCharOp)) {
        tokens.push({
          type: TokenType.OPERATOR,
          value: twoCharOp,
          line: this.line,
          column: this.col
        });
        this.advance();
        this.advance();
        continue;
      }

      if (JEAN_OPERATORS.includes(char)) {
        tokens.push({
          type: TokenType.OPERATOR,
          value: char,
          line: this.line,
          column: this.col
        });
        this.advance();
        continue;
      }

      if (JEAN_SEPARATORS.includes(char)) {
        tokens.push({
          type: TokenType.SEPARATOR,
          value: char,
          line: this.line,
          column: this.col
        });
        this.advance();
        continue;
      }

      console.error(`Unknown character: ${char} at ${this.line}:${this.col}`);
      this.advance();
    }

    tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.col });
    return tokens;
  }

  private readIdentifier(): Token {
    let value = '';
    const startCol = this.col;
    while (/[a-zA-Z0-9_]/.test(this.peek())) {
      value += this.advance();
    }
    const type = JEAN_KEYWORDS.includes(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
    if (value === 'true' || value === 'false') return { type: TokenType.BOOLEAN, value, line: this.line, column: startCol };
    return { type, value, line: this.line, column: startCol };
  }

  private readNumber(): Token {
    let value = '';
    const startCol = this.col;
    while (/[0-9.]/.test(this.peek())) {
      value += this.advance();
    }
    return { type: TokenType.NUMBER, value, line: this.line, column: startCol };
  }

  private readString(): Token {
    this.advance(); // open quote
    let value = '';
    const startCol = this.col;
    while (this.peek() && this.peek() !== '"') {
      value += this.advance();
    }
    this.advance(); // close quote
    return { type: TokenType.STRING, value, line: this.line, column: startCol };
  }
}
