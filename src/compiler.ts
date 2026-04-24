/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Token, TokenType, CompilerResult } from './types';
import { Lexer } from './lexer';

class Emitter {
  private output: string = '';
  private indent: number = 0;

  public emit(text: string) {
    this.output += '  '.repeat(this.indent) + text + '\n';
  }

  public push() { this.indent++; }
  public pop() { this.indent--; }
  public getOutput(): string { return this.output; }
}

// Basic Parser and Emitter implementation for Jean -> WAT
export class JeanCompiler {
  private tokens: Token[] = [];
  private current: number = 0;
  private errors: string[] = [];

  constructor() {}

  public compile(source: string): CompilerResult {
    this.errors = [];
    try {
      const lexer = new Lexer(source);
      this.tokens = lexer.tokenize();
      this.current = 0;

      const emitter = new Emitter();
      const ast: any = { type: 'Program', body: [] };
      emitter.emit('(module');
      emitter.push();
      emitter.emit('(import "env" "say" (func $say (param i32 i32)))');
      emitter.emit('(import "env" "say_i32" (func $say_i32 (param i32)))');
      emitter.emit('(import "env" "ask" (func $ask (param i32 i32) (result i32)))');
      emitter.emit('(import "env" "log" (func $log (param i32 i32 i32 i32)))');
      emitter.emit('(import "env" "drive" (func $drive (param i32 i32 i32 i32)))');
      emitter.emit('(import "env" "memory" (memory 1))');
      
      // String pool collection
      const strings: string[] = [];
      const stringOffsets: Map<number, number> = new Map();
      let currentOffset = 0;

      // Temporary pass to find strings and map them to memory
      let searchIdx = 0;
      const globals: { name: string, value: string }[] = [];
      while (searchIdx < this.tokens.length) {
        const t = this.tokens[searchIdx];
        if (t.type === TokenType.KEYWORD) {
          if (['say', 'ask', 'log', 'asm', 'drive'].includes(t.value)) {
            // Look ahead for strings in arguments
            let lookAhead = searchIdx + 1;
            while (lookAhead < this.tokens.length && 
                   (this.tokens[lookAhead].type !== TokenType.SEPARATOR || this.tokens[lookAhead].value !== ')')) {
              const arg = this.tokens[lookAhead];
              if (arg.type === TokenType.STRING) {
                stringOffsets.set(lookAhead, currentOffset);
                strings.push(arg.value);
                currentOffset += arg.value.length;
              }
              lookAhead++;
            }
          } else if (['let', 'mut'].includes(t.value)) {
            const name = this.tokens[searchIdx + 1]?.value;
            let val = '0';
            let lookAhead = searchIdx + 2;
            while (lookAhead < this.tokens.length && this.tokens[lookAhead].value !== '=') lookAhead++;
            if (this.tokens[lookAhead + 1]?.type === TokenType.NUMBER) {
                val = this.tokens[lookAhead + 1].value;
            }
            if (name) globals.push({ name, value: val });
          }
        }
        searchIdx++;
      }

      // Emit data section
      let totalDataOffset = 0;
      strings.forEach((str) => {
        // Simple escape for wasm data string
        const escaped = str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        emitter.emit(`(data (i32.const ${totalDataOffset}) "${escaped}")`);
        totalDataOffset += str.length;
      });

      // Emit globals
      globals.forEach(g => {
        emitter.emit(`(global $${g.name} (mut i32) (i32.const ${g.value}))`);
      });

      emitter.emit('(func (export "main")');
      emitter.push();
      
      let inWhile = false;
      let whileVar = '';

      while (this.peek().type !== TokenType.EOF) {
        const token = this.peek();
        const tokenIdx = this.current;

        if (token.type === TokenType.KEYWORD) {
          if (['say', 'ask', 'log', 'asm', 'drive'].includes(token.value)) {
            const func = token.value;
            this.advance();
            this.consume(TokenType.SEPARATOR, '(', `Expected '(' after '${func}'`);
            
            const args: any[] = [];
            while (this.peek().type !== TokenType.SEPARATOR || this.peek().value !== ')') {
              const currentToken = this.peek();
              if (currentToken.type === TokenType.STRING) {
                const strToken = this.advance();
                const offset = stringOffsets.get(this.current - 1) || 0;
                args.push({ type: 'StringLiteral', value: strToken.value, offset, length: strToken.value.length });
              } else if (currentToken.type === TokenType.NUMBER) {
                const numVal = this.advance().value;
                args.push({ type: 'NumberLiteral', value: numVal });
              } else if (currentToken.type === TokenType.IDENTIFIER || currentToken.type === TokenType.KEYWORD) {
                args.push({ type: 'Identifier', value: this.advance().value });
              } else {
                this.advance(); 
              }
              
              if (this.peek().value === ',') this.advance();
            }
            this.consume(TokenType.SEPARATOR, ')', `Expected ')' after ${func}`);

            ast.body.push({ type: 'CallExpression', callee: func, arguments: args });

            if (func === 'asm') {
                if (args.length > 0 && args[0].type === 'StringLiteral') {
                    emitter.emit(args[0].value);
                }
            } else {
                let callTarget = func;
                args.forEach(arg => {
                    if (arg.type === 'StringLiteral') {
                        emitter.emit(`(i32.const ${arg.offset}) (i32.const ${arg.length})`);
                    } else if (arg.type === 'NumberLiteral') {
                        emitter.emit(`(i32.const ${arg.value})`);
                        if (func === 'say') callTarget = 'say_i32';
                    } else if (arg.type === 'Identifier') {
                        emitter.emit(`(global.get $${arg.value})`);
                        if (func === 'say') callTarget = 'say_i32';
                    }
                });

                emitter.emit(`(call $${callTarget})`);
                if (func === 'ask') {
                    emitter.emit(`(drop)`);
                }
            }
          } else if (['let', 'mut'].includes(token.value)) {
            const kind = this.advance().value;
            if (kind === 'let' && this.peek().value === 'mut') {
              this.advance();
            }
            const name = this.advance().value;
            let type = 'any';
            if (this.peek().value === ':') {
              this.advance();
              type = this.advance().value;
            }
            if (this.peek().value === '=') {
              this.advance();
              const val = this.advance().value;
              ast.body.push({ type: 'VariableDeclaration', kind, name, varType: type, value: val });
            }
          } else if (token.value === 'while') {
            this.advance();
            whileVar = this.advance().value; 
            if (this.peek().value === '<') {
                this.advance();
                const limit = this.advance().value;
                if (this.peek().value === ':') this.advance();
                
                emitter.emit(`(block $while_end (loop $while_start`);
                emitter.push();
                emitter.emit(`(global.get $${whileVar}) (i32.const ${limit}) (i32.ge_s) (br_if $while_end)`);
                ast.body.push({ type: 'WhileStatement', condition: `${whileVar} < ${limit}` });
                inWhile = true;
            }
          } else if (token.type === TokenType.IDENTIFIER && this.tokens[this.current + 1]?.value === '=') {
              const name = this.advance().value;
              this.advance(); // =
              
              if (this.peek().value === name) {
                this.advance(); 
                const op = this.advance().value;
                const val = this.advance().value;
                if (op === '+') {
                  emitter.emit(`(global.get $${name}) (i32.const ${val}) (i32.add) (global.set $${name})`);
                }
              } else {
                const val = this.advance().value;
                emitter.emit(`(i32.const ${val}) (global.set $${name})`);
              }
              
              if (inWhile && name === whileVar) {
                  emitter.emit(`(br $while_start)`);
                  emitter.pop();
                  emitter.emit('))');
                  inWhile = false;
              }
              ast.body.push({ type: 'Assignment', name });
          } else if (token.value === 'def' || token.value === 'type') {
            const nodeType = this.advance().value === 'def' ? 'FunctionDeclaration' : 'TypeDeclaration';
            const name = this.consume(TokenType.IDENTIFIER, '', `Expected ${nodeType} name`).value;
            ast.body.push({ type: nodeType, name });
          } else {
            ast.body.push({ type: 'Keyword', value: this.advance().value });
          }
        } else {
          this.advance();
        }
      }

      if (inWhile) {
          emitter.emit(`(br $while_start)`);
          emitter.pop();
          emitter.emit('))');
      }

      emitter.pop();
      emitter.emit(')'); // Close main
      emitter.pop();
      emitter.emit(')'); // Close module

      return {
        wat: emitter.getOutput(),
        wasm: null,
        errors: this.errors,
        ast
      };
    } catch (e) {
      return { wat: '', wasm: null, errors: [(e as Error).message] };
    }
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private advance(): Token {
    if (this.current < this.tokens.length) this.current++;
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, value: string, message: string): Token {
    const token = this.peek();
    if (token.type === type && (value === '' || token.value === value)) {
      return this.advance();
    }
    throw new Error(`${message} at ${token.line}:${token.column}`);
  }
}

// Factory Pattern as requested
export class CompilerFactory {
  static create(lang: string) {
    if (lang === 'jean') {
      return new JeanCompiler();
    }
    throw new Error('Unsupported language');
  }
}
