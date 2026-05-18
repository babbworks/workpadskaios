// formula.js — RPN bytecode formula evaluator
// Opcodes: LOAD_FIELD(0x1), LOAD_CONST(0x2), ADD(0x3), SUB(0x4), MUL(0x5), DIV(0x6), END(0x7)
// Exposes: global.WPFormula

'use strict';

(function(global) {

  var OP_LOAD_FIELD = 0x01;
  var OP_LOAD_CONST = 0x02;
  var OP_ADD        = 0x03;
  var OP_SUB        = 0x04;
  var OP_MUL        = 0x05;
  var OP_DIV        = 0x06;
  var OP_END        = 0x07;

  // evaluate(bytecode: Uint8Array, record: object, fieldNames: string[]) → number
  // fieldNames maps field index (used by LOAD_FIELD) to record property name.
  function evaluate(bytecode, record, fieldNames) {
    var stack = [];
    var ip    = 0;
    var a, b;

    while (ip < bytecode.length) {
      var op = bytecode[ip++];
      if (op === OP_END) break;

      if (op === OP_LOAD_FIELD) {
        var idx   = bytecode[ip++];
        var fname = fieldNames && fieldNames[idx];
        var fval  = fname != null ? parseFloat(record[fname]) : 0;
        stack.push(isNaN(fval) ? 0 : fval);
      } else if (op === OP_LOAD_CONST) {
        var hi  = (bytecode[ip]   || 0) << 16;
        var mid = (bytecode[ip+1] || 0) << 8;
        var lo  =  bytecode[ip+2] || 0;
        ip += 3;
        stack.push(hi | mid | lo);
      } else if (op === OP_ADD) {
        b = stack.pop() || 0; a = stack.pop() || 0; stack.push(a + b);
      } else if (op === OP_SUB) {
        b = stack.pop() || 0; a = stack.pop() || 0; stack.push(a - b);
      } else if (op === OP_MUL) {
        b = stack.pop() || 0; a = stack.pop() || 0; stack.push(a * b);
      } else if (op === OP_DIV) {
        b = stack.pop() || 0; a = stack.pop() || 0;
        stack.push(b !== 0 ? a / b : 0);
      }
    }
    return stack.length > 0 ? stack[stack.length - 1] : 0;
  }

  global.WPFormula = {
    evaluate:     evaluate,
    OP_LOAD_FIELD: OP_LOAD_FIELD,
    OP_LOAD_CONST: OP_LOAD_CONST,
    OP_ADD:        OP_ADD,
    OP_SUB:        OP_SUB,
    OP_MUL:        OP_MUL,
    OP_DIV:        OP_DIV,
    OP_END:        OP_END
  };

}(typeof window !== 'undefined' ? window : global));
