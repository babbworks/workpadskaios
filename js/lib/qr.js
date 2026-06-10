/**
 * qr.js — MiniQR: self-contained QR code generator
 *
 * Pure ES5, no external dependencies.
 * Byte mode, ECL M (15% error correction), versions 1-20.
 *
 * Usage:
 *   window.MiniQR.generate(text, canvasElement, size)
 *
 * size defaults to 200 pixels. Quiet zone of 4 modules is included.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // GF(256) arithmetic — primitive polynomial 0x11D (x^8+x^4+x^3+x^2+1)
  // ---------------------------------------------------------------------------

  var GF_EXP = new Array(512);
  var GF_LOG  = new Array(256);

  (function buildGFTables() {
    var x = 1;
    var i;
    for (i = 0; i < 256; i++) {
      GF_EXP[i] = x;
      GF_LOG[x]  = i;
      x = x << 1;
      if (x & 0x100) {
        x = x ^ 0x11D;
      }
    }
    // Duplicate for wrap-around convenience
    for (i = 256; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 256];
    }
    GF_LOG[0] = 0; // undefined, but set to 0 to avoid NaN
  }());

  function gfMul(a, b) {
    if (a === 0 || b === 0) { return 0; }
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
  }

  function gfPow(x, power) {
    return GF_EXP[(GF_LOG[x] * power) % 255];
  }

  // ---------------------------------------------------------------------------
  // Reed-Solomon — generator polynomial + encode
  // ---------------------------------------------------------------------------

  /**
   * Build the RS generator polynomial of degree `nEC`.
   * Returns array of coefficients (length nEC+1, leading coeff first).
   */
  function rsGen(nEC) {
    var g = [1];
    var i, j, factor;
    for (i = 0; i < nEC; i++) {
      factor = gfPow(2, i);
      // Multiply g by (x - alpha^i), in GF add == XOR
      var ng = new Array(g.length + 1);
      for (j = 0; j < ng.length; j++) { ng[j] = 0; }
      for (j = 0; j < g.length; j++) {
        ng[j]     = ng[j] ^ g[j];
        ng[j + 1] = ng[j + 1] ^ gfMul(g[j], factor);
      }
      g = ng;
    }
    return g;
  }

  /**
   * Encode `data` (array of byte values) with `nEC` error correction codewords.
   * Returns the EC codeword array (length nEC).
   */
  function rsEncode(data, nEC) {
    var gen = rsGen(nEC);
    var msg = data.slice(0);
    var i, j, coef;
    // Pad message to length data.length + nEC
    for (i = 0; i < nEC; i++) { msg.push(0); }
    for (i = 0; i < data.length; i++) {
      coef = msg[i];
      if (coef !== 0) {
        for (j = 1; j < gen.length; j++) {
          msg[i + j] = msg[i + j] ^ gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  // ---------------------------------------------------------------------------
  // Version capacity tables — ECL M
  // ---------------------------------------------------------------------------

  // Total data codewords per version (ECL M)
  var M_DATA_CAP = [
    0,   // index 0 unused
    16, 28, 44, 64, 86, 108, 124, 154, 182, 216,
    254, 290, 334, 365, 415, 453, 507, 563, 627, 669
  ];

  // Block structure for ECL M.
  // Each entry: [ [count, ecPerBlock, dataPerBlock], [count2, ec2, data2] ]
  // Group 2 may be null.
  var M_BLOCKS = [
    null, // v0 unused
    [[1, 10, 16], null],
    [[1, 16, 28], null],
    [[1, 26, 44], null],
    [[2, 18, 32], null],
    [[2, 24, 43], null],
    [[4, 16, 27], null],
    [[4, 18, 31], null],
    [[2, 22, 38], [2, 22, 39]],
    [[3, 22, 36], [2, 22, 37]],
    [[4, 26, 43], [1, 26, 44]],
    [[1, 30, 50], [4, 30, 51]],
    [[6, 22, 36], [2, 22, 37]],
    [[8, 22, 37], [1, 22, 38]],
    [[4, 24, 40], [5, 24, 41]],
    [[5, 24, 41], [5, 24, 42]],
    [[7, 28, 45], [3, 28, 46]],
    [[10, 28, 46], [1, 28, 47]],
    [[9, 26, 43], [4, 26, 44]],
    [[3, 26, 44], [11, 26, 45]],
    [[3, 30, 41], [13, 30, 42]]
  ];

  // Alignment pattern center coordinates per version (v1 has none)
  var ALIGN_CENTERS = [
    [],           // v1
    [6, 18],      // v2
    [6, 22],      // v3
    [6, 26],      // v4
    [6, 30],      // v5
    [6, 34],      // v6
    [6, 22, 38],  // v7
    [6, 24, 42],  // v8
    [6, 26, 46],  // v9
    [6, 28, 50],  // v10
    [6, 30, 54],  // v11
    [6, 32, 58],  // v12
    [6, 34, 62],  // v13
    [6, 26, 46, 66], // v14
    [6, 26, 48, 70], // v15
    [6, 26, 50, 74], // v16
    [6, 30, 54, 78], // v17
    [6, 30, 56, 82], // v18
    [6, 30, 58, 86], // v19
    [6, 34, 62, 90]  // v20
  ];

  // ---------------------------------------------------------------------------
  // UTF-8 byte length helper
  // ---------------------------------------------------------------------------

  /**
   * Compute the UTF-8 encoded byte length of a string without allocating.
   */
  function utf8ByteLength(str) {
    var n = 0;
    var i, code, hi, lo;
    for (i = 0; i < str.length; i++) {
      code = str.charCodeAt(i);
      if (code < 0x80) {
        n += 1;
      } else if (code < 0x800) {
        n += 2;
      } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
        lo = str.charCodeAt(i + 1);
        if (lo >= 0xDC00 && lo <= 0xDFFF) {
          i++;
          n += 4; // surrogate pair = one supplementary code point = 4 UTF-8 bytes
        } else {
          n += 3; // lone high surrogate
        }
      } else {
        n += 3;
      }
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  // Select version
  // ---------------------------------------------------------------------------

  /**
   * Given the UTF-8 byte length of the data, return the minimum version (1-20)
   * for ECL M byte mode encoding. Throws if data is too long for v20.
   */
  function selectVersion(byteLen) {
    // Byte mode: 4 bits mode indicator + 8 bits char-count (v1-9) or 16 bits (v10+)
    // Then data bytes * 8, then 4-bit terminator. Compute needed codewords.
    var v, cap, headerBits, totalBits, neededBytes;
    for (v = 1; v <= 20; v++) {
      // Length field is 8 bits for v1-9, 16 bits for v10-40
      headerBits  = (v <= 9) ? (4 + 8) : (4 + 16);
      totalBits   = headerBits + byteLen * 8 + 4; // +4 for terminator
      neededBytes = Math.ceil(totalBits / 8);
      cap         = M_DATA_CAP[v];
      if (neededBytes <= cap) {
        return v;
      }
    }
    throw new Error('MiniQR: data too long for version 20 ECL M (max ~560 bytes)');
  }

  // ---------------------------------------------------------------------------
  // Build data codeword sequence
  // ---------------------------------------------------------------------------

  /**
   * Encode text in byte mode, pad to capacity, return array of codewords.
   */
  function buildDataCodewords(text, version) {
    var cap = M_DATA_CAP[version];
    var bytes = [];
    var i, code;

    // Convert text to UTF-8 bytes
    for (i = 0; i < text.length; i++) {
      code = text.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xC0 | (code >> 6));
        bytes.push(0x80 | (code & 0x3F));
      } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
        // Surrogate pair
        var hi = code;
        var lo = text.charCodeAt(i + 1);
        if (lo >= 0xDC00 && lo <= 0xDFFF) {
          i++;
          var cp = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
          bytes.push(0xF0 | (cp >> 18));
          bytes.push(0x80 | ((cp >> 12) & 0x3F));
          bytes.push(0x80 | ((cp >> 6) & 0x3F));
          bytes.push(0x80 | (cp & 0x3F));
        } else {
          bytes.push(0xEF); bytes.push(0xBF); bytes.push(0xBD); // replacement char
        }
      } else {
        bytes.push(0xE0 | (code >> 12));
        bytes.push(0x80 | ((code >> 6) & 0x3F));
        bytes.push(0x80 | (code & 0x3F));
      }
    }

    var dataLen = bytes.length;
    var isLongVersion = (version >= 10);

    // Build bit stream
    var bits = [];

    function pushBits(val, n) {
      var bit;
      for (bit = n - 1; bit >= 0; bit--) {
        bits.push((val >> bit) & 1);
      }
    }

    // Mode indicator: 0100 = byte mode
    pushBits(4, 4);
    // Character count: 8 bits (v1-9) or 16 bits (v10-40)
    if (isLongVersion) {
      pushBits(dataLen, 16);
    } else {
      pushBits(dataLen, 8);
    }
    // Data bytes
    for (i = 0; i < dataLen; i++) {
      pushBits(bytes[i], 8);
    }
    // Terminator (up to 4 zeros)
    var term = Math.min(4, cap * 8 - bits.length);
    for (i = 0; i < term; i++) { bits.push(0); }
    // Pad to byte boundary
    while (bits.length % 8 !== 0) { bits.push(0); }

    // Convert to codewords
    var codewords = [];
    for (i = 0; i < bits.length; i += 8) {
      codewords.push(
        (bits[i]   << 7) | (bits[i+1] << 6) | (bits[i+2] << 5) | (bits[i+3] << 4) |
        (bits[i+4] << 3) | (bits[i+5] << 2) | (bits[i+6] << 1) |  bits[i+7]
      );
    }

    // Pad codewords to capacity with alternating 0xEC / 0x11
    var pad = [0xEC, 0x11];
    var padIdx = 0;
    while (codewords.length < cap) {
      codewords.push(pad[padIdx % 2]);
      padIdx++;
    }

    return codewords;
  }

  // ---------------------------------------------------------------------------
  // Interleave data + EC codewords
  // ---------------------------------------------------------------------------

  /**
   * Split data codewords into blocks, compute EC for each, interleave.
   * Returns the final codeword array ready for placement.
   */
  function interleaveBlocks(dataCW, version) {
    var blockDef = M_BLOCKS[version];
    var group1   = blockDef[0];
    var group2   = blockDef[1];

    var blocks   = [];
    var ecBlocks = [];
    var offset   = 0;
    var i, j, grp, cnt, ecN, dataN, blockData;

    // Helper: push blocks from one group definition
    function addGroup(grp) {
      if (!grp) { return; }
      cnt  = grp[0];
      ecN  = grp[1];
      dataN = grp[2];
      for (i = 0; i < cnt; i++) {
        blockData = dataCW.slice(offset, offset + dataN);
        offset += dataN;
        blocks.push(blockData);
        ecBlocks.push(rsEncode(blockData, ecN));
      }
    }

    addGroup(group1);
    addGroup(group2);

    // Interleave data codewords
    var result = [];
    var maxData = 0;
    for (i = 0; i < blocks.length; i++) {
      if (blocks[i].length > maxData) { maxData = blocks[i].length; }
    }
    for (j = 0; j < maxData; j++) {
      for (i = 0; i < blocks.length; i++) {
        if (j < blocks[i].length) {
          result.push(blocks[i][j]);
        }
      }
    }

    // Interleave EC codewords
    var maxEC = 0;
    for (i = 0; i < ecBlocks.length; i++) {
      if (ecBlocks[i].length > maxEC) { maxEC = ecBlocks[i].length; }
    }
    for (j = 0; j < maxEC; j++) {
      for (i = 0; i < ecBlocks.length; i++) {
        if (j < ecBlocks[i].length) {
          result.push(ecBlocks[i][j]);
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // QR matrix construction
  // ---------------------------------------------------------------------------

  /**
   * Create a 2D matrix of size x size filled with value.
   */
  function makeMatrix(size, val) {
    var mat = [];
    var i, j;
    for (i = 0; i < size; i++) {
      mat[i] = [];
      for (j = 0; j < size; j++) {
        mat[i][j] = val;
      }
    }
    return mat;
  }

  /**
   * Place a finder pattern centered at (row, col).
   * The 7x7 pattern includes the border ring.
   */
  function placeFinder(mat, row, col) {
    var r, c, dr, dc;
    for (dr = -3; dr <= 3; dr++) {
      for (dc = -3; dc <= 3; dc++) {
        r = row + dr;
        c = col + dc;
        if (r < 0 || c < 0 || r >= mat.length || c >= mat.length) { continue; }
        var adr = Math.abs(dr);
        var adc = Math.abs(dc);
        // Outer ring (3), inner ring (1=white), center 3x3 (dark)
        if (adr === 3 || adc === 3) {
          mat[r][c] = 1; // dark
        } else if (adr === 2 || adc === 2) {
          mat[r][c] = 0; // light
        } else {
          mat[r][c] = 1; // dark center
        }
      }
    }
  }

  /**
   * Place separators (light modules) around a finder pattern.
   * row, col is the top-left corner of the 7x7 finder.
   * corner: 'TL', 'TR', 'BL'
   */
  function placeSeparator(mat, finderRow, finderCol, corner) {
    var size = mat.length;
    var r, c;

    if (corner === 'TL') {
      // Right side
      for (r = 0; r <= 7; r++) {
        if (finderRow + r < size && finderCol + 7 < size) {
          mat[finderRow + r][finderCol + 7] = 0;
        }
      }
      // Bottom side
      for (c = 0; c <= 7; c++) {
        if (finderRow + 7 < size && finderCol + c < size) {
          mat[finderRow + 7][finderCol + c] = 0;
        }
      }
    } else if (corner === 'TR') {
      // Left side
      for (r = 0; r <= 7; r++) {
        if (finderRow + r < size && finderCol - 1 >= 0) {
          mat[finderRow + r][finderCol - 1] = 0;
        }
      }
      // Bottom side
      for (c = 0; c <= 7; c++) {
        if (finderRow + 7 < size && finderCol + c < size) {
          mat[finderRow + 7][finderCol + c] = 0;
        }
      }
    } else if (corner === 'BL') {
      // Right side
      for (r = 0; r <= 7; r++) {
        if (finderRow + r < size && finderCol + 7 < size) {
          mat[finderRow + r][finderCol + 7] = 0;
        }
      }
      // Top side
      for (c = 0; c <= 7; c++) {
        if (finderRow - 1 >= 0 && finderCol + c < size) {
          mat[finderRow - 1][finderCol + c] = 0;
        }
      }
    }
  }

  /**
   * Place an alignment pattern (5x5) centered at (row, col).
   */
  function placeAlignment(mat, row, col) {
    var dr, dc, r, c;
    for (dr = -2; dr <= 2; dr++) {
      for (dc = -2; dc <= 2; dc++) {
        r = row + dr;
        c = col + dc;
        if (r < 0 || c < 0 || r >= mat.length || c >= mat.length) { continue; }
        var adr = Math.abs(dr);
        var adc = Math.abs(dc);
        if (adr === 2 || adc === 2) {
          mat[r][c] = 1;
        } else if (adr === 1 || adc === 1) {
          mat[r][c] = 0;
        } else {
          mat[r][c] = 1;
        }
      }
    }
  }

  /**
   * Reserve format info strips with a placeholder value of 2 (reserved).
   * Also place the dark module at (8, size-8) per spec.
   */
  function reserveFormatInfo(mat) {
    var size = mat.length;
    var i;

    // Top-left horizontal strip (row 8, cols 0-8)
    for (i = 0; i <= 8; i++) {
      if (mat[8][i] === -1) { mat[8][i] = 2; }
    }
    // Top-left vertical strip (col 8, rows 0-8)
    for (i = 0; i <= 8; i++) {
      if (mat[i][8] === -1) { mat[i][8] = 2; }
    }
    // Top-right strip (row 8, cols size-8 to size-1)
    for (i = size - 8; i < size; i++) {
      if (mat[8][i] === -1) { mat[8][i] = 2; }
    }
    // Bottom-left strip (col 8, rows size-7 to size-1)
    for (i = size - 7; i < size; i++) {
      if (mat[i][8] === -1) { mat[i][8] = 2; }
    }

    // Dark module (always dark, per spec)
    mat[size - 8][8] = 1;
  }

  /**
   * Check if a cell is already occupied (not -1).
   */
  function isReserved(mat, r, c) {
    return mat[r][c] !== -1;
  }

  /**
   * Place data bits into the matrix using the zigzag pattern.
   * `bits` is a flat array of 0/1 values.
   */
  function placeDataBits(mat, bits) {
    var size = mat.length;
    var bitIdx = 0;
    var col = size - 1;
    var goingUp = true;
    var r, c, dc;

    while (col >= 0) {
      // Skip timing column 6
      if (col === 6) { col--; }

      for (r = (goingUp ? size - 1 : 0); goingUp ? r >= 0 : r < size; r += (goingUp ? -1 : 1)) {
        for (dc = 0; dc <= 1; dc++) {
          c = col - dc;
          if (!isReserved(mat, r, c)) {
            if (bitIdx < bits.length) {
              mat[r][c] = bits[bitIdx++];
            } else {
              mat[r][c] = 0;
            }
          }
        }
      }

      goingUp = !goingUp;
      col -= 2;
    }
  }

  // ---------------------------------------------------------------------------
  // Masking
  // ---------------------------------------------------------------------------

  var MASK_FNS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r, c) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
    function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
  ];

  /**
   * Apply mask `maskId` to a copy of the matrix (data cells only).
   */
  function applyMask(mat, maskId) {
    var size = mat.length;
    var result = makeMatrix(size, 0);
    var r, c;
    var fn = MASK_FNS[maskId];
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        if (mat[r][c] === 0 || mat[r][c] === 1) {
          // Data cell
          result[r][c] = fn(r, c) ? (mat[r][c] ^ 1) : mat[r][c];
        } else {
          // Reserved / functional: copy as-is (treat 2 as 0 placeholder)
          result[r][c] = mat[r][c];
        }
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Penalty scoring (rules 1-4)
  // ---------------------------------------------------------------------------

  function scorePenalty(mat) {
    var size = mat.length;
    var score = 0;
    var r, c, i, j, run;

    // Helper: get module value (reserved cells treated as 0)
    function m(r, c) {
      var v = mat[r][c];
      return (v === 1) ? 1 : 0;
    }

    // Rule 1: Five or more consecutive same-colour modules in a row or column
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m(r, c) === m(r, c - 1)) {
          run++;
          if (run === 5) { score += 3; }
          else if (run > 5) { score += 1; }
        } else {
          run = 1;
        }
      }
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m(r, c) === m(r - 1, c)) {
          run++;
          if (run === 5) { score += 3; }
          else if (run > 5) { score += 1; }
        } else {
          run = 1;
        }
      }
    }

    // Rule 2: 2x2 blocks of same colour
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m(r, c);
        if (v === m(r, c + 1) && v === m(r + 1, c) && v === m(r + 1, c + 1)) {
          score += 3;
        }
      }
    }

    // Rule 3: Specific patterns (finder-like)
    // Pattern: 1,0,1,1,1,0,1,0,0,0,0  or  0,0,0,0,1,0,1,1,1,0,1
    var p1 = [1,0,1,1,1,0,1,0,0,0,0];
    var p2 = [0,0,0,0,1,0,1,1,1,0,1];
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        var match1 = true, match2 = true;
        for (i = 0; i < 11; i++) {
          if (m(r, c + i) !== p1[i]) { match1 = false; }
          if (m(r, c + i) !== p2[i]) { match2 = false; }
        }
        if (match1 || match2) { score += 40; }
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r <= size - 11; r++) {
        var match3 = true, match4 = true;
        for (i = 0; i < 11; i++) {
          if (m(r + i, c) !== p1[i]) { match3 = false; }
          if (m(r + i, c) !== p2[i]) { match4 = false; }
        }
        if (match3 || match4) { score += 40; }
      }
    }

    // Rule 4: Proportion of dark modules
    var dark = 0;
    var total = size * size;
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        if (m(r, c)) { dark++; }
      }
    }
    var pct = dark / total * 100;
    var prev5 = Math.floor(pct / 5) * 5;
    var next5 = prev5 + 5;
    score += Math.min(Math.abs(prev5 - 50), Math.abs(next5 - 50)) * 2;

    return score;
  }

  // ---------------------------------------------------------------------------
  // Format information
  // ---------------------------------------------------------------------------

  /**
   * Compute BCH(15,5) error correction for the 5-bit format data.
   * Generator polynomial: x^10 + x^8 + x^5 + x^4 + x^2 + x + 1 = 0x537
   * Returns 15-bit format string (before masking with 0x5412).
   */
  function formatBCH(data5) {
    // data5 is 5 bits; shift left 10 to make room for 10 EC bits
    var d = data5 << 10;
    var gen = 0x537;
    var i;
    for (i = 14; i >= 10; i--) {
      if (d & (1 << i)) {
        d ^= (gen << (i - 10));
      }
    }
    return (data5 << 10) | d;
  }

  /**
   * Compute the 15-bit format string for ECL M + maskId.
   * ECL M indicator bits: 00.
   * format_data = (ecl << 3) | mask = (0 << 3) | mask = mask (5 bits)
   */
  function formatString(maskId) {
    var data5 = maskId; // ECL M = 00, so (0 << 3) | maskId = maskId
    var fmt = formatBCH(data5);
    return fmt ^ 0x5412;
  }

  /**
   * Write the 15-bit format string into the matrix at the two format info positions.
   */
  function writeFormatInfo(mat, maskId) {
    var size = mat.length;
    var fmt  = formatString(maskId);
    var i, bit;

    // Format info bit order (bit 14 = MSB of format string)
    // Position 1: around TL finder
    // Horizontal (row 8, cols 0..5, skip 6 (timing), 7, 8)
    // and vertical (col 8, rows 0..5, skip 6 (timing), 7, 8)

    // Bit positions in format string:
    // bits 0-5 go in certain cells, bits 7-14 in others.
    // Per QR spec Table 25:
    // i=0..5 => row8 col i; i=6 => skip; i=7 => row8 col8; i=8 => row7 col8;
    // i=9..14 => rows 5..0 col8 (reverse)

    // Around TL finder:
    var rowPos = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
    var colPos = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];

    for (i = 0; i < 15; i++) {
      bit = (fmt >> i) & 1;
      mat[rowPos[i]][colPos[i]] = bit;
    }

    // Around TR and BL finders (copy):
    // TR: row 8, cols size-1 down to size-8 (bits 0..7, MSB first — bit 7..0)
    // BL: col 8, rows size-7 up to size-1 (bits 8..14, LSB first — bit 8..14... )

    // Per spec: TR strip gets bits 14 down to 8 (left to right: bit14..bit8), then bit7 at col size-8
    // Wait — let's follow spec precisely.
    // TR (row 8, cols size-7 to size-1): bits 0..7 (bit0 at rightmost = col size-1)
    for (i = 0; i < 8; i++) {
      bit = (fmt >> i) & 1;
      mat[8][size - 1 - i] = bit;
    }
    // BL (col 8, rows size-7 to size-1): bits 14 down to 8 (bit14 at topmost = row size-7)
    for (i = 0; i < 7; i++) {
      bit = (fmt >> (14 - i)) & 1;
      mat[size - 7 + i][8] = bit;
    }
  }

  // ---------------------------------------------------------------------------
  // Main matrix builder
  // ---------------------------------------------------------------------------

  function buildMatrix(version, finalCW) {
    var size = version * 4 + 17;
    // -1 means unoccupied
    var mat = makeMatrix(size, -1);
    var i, j, r, c;

    // --- Finder patterns ---
    // Top-left: center at (3,3), top-left corner at (0,0)
    placeFinder(mat, 3, 3);
    placeSeparator(mat, 0, 0, 'TL');
    // Top-right: center at (3, size-4), top-left corner at (0, size-7)
    placeFinder(mat, 3, size - 4);
    placeSeparator(mat, 0, size - 7, 'TR');
    // Bottom-left: center at (size-4, 3), top-left corner at (size-7, 0)
    placeFinder(mat, size - 4, 3);
    placeSeparator(mat, size - 7, 0, 'BL');

    // --- Timing patterns ---
    // Horizontal (row 6, cols 8 to size-9)
    for (c = 8; c <= size - 9; c++) {
      mat[6][c] = (c % 2 === 0) ? 1 : 0;
    }
    // Vertical (col 6, rows 8 to size-9)
    for (r = 8; r <= size - 9; r++) {
      mat[r][6] = (r % 2 === 0) ? 1 : 0;
    }

    // --- Alignment patterns ---
    if (version >= 2) {
      var centers = ALIGN_CENTERS[version - 1]; // 0-indexed, v2=index1
      for (i = 0; i < centers.length; i++) {
        for (j = 0; j < centers.length; j++) {
          r = centers[i];
          c = centers[j];
          // Skip if overlapping a finder pattern area
          if (mat[r][c] !== -1) { continue; }
          placeAlignment(mat, r, c);
        }
      }
    }

    // --- Reserve format info strips ---
    reserveFormatInfo(mat);

    // --- Build bit stream from codewords ---
    var bits = [];
    for (i = 0; i < finalCW.length; i++) {
      var b;
      for (b = 7; b >= 0; b--) {
        bits.push((finalCW[i] >> b) & 1);
      }
    }
    // Remainder bits (QR spec Table 1)
    var remainderBits = [0,7,7,7,7,7,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0];
    var rem = remainderBits[version] || 0;
    for (i = 0; i < rem; i++) { bits.push(0); }

    // --- Place data bits ---
    placeDataBits(mat, bits);

    // --- Pick best mask ---
    var bestMask  = 0;
    var bestScore = Infinity;
    var maskId, masked, score;
    for (maskId = 0; maskId < 8; maskId++) {
      masked = applyMask(mat, maskId);
      writeFormatInfo(masked, maskId);
      score  = scorePenalty(masked);
      if (score < bestScore) {
        bestScore = score;
        bestMask  = maskId;
      }
    }

    // Apply the winning mask and write format info
    var finalMat = applyMask(mat, bestMask);
    writeFormatInfo(finalMat, bestMask);

    return finalMat;
  }

  // ---------------------------------------------------------------------------
  // Canvas rendering
  // ---------------------------------------------------------------------------

  /**
   * Render the QR matrix onto a canvas element.
   * Includes a quiet zone of 4 modules around the symbol.
   */
  function renderToCanvas(mat, canvasEl, pixelSize) {
    var size     = mat.length;
    var quietZone = 4;
    var totalModules = size + quietZone * 2;
    var moduleSize   = pixelSize / totalModules;

    canvasEl.width  = pixelSize;
    canvasEl.height = pixelSize;

    var ctx = canvasEl.getContext('2d');

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pixelSize, pixelSize);

    // Draw dark modules
    ctx.fillStyle = '#000000';

    var r, c, x, y, w, h;
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        var v = mat[r][c];
        // Treat 1 as dark; 2 (reserved, shouldn't be left) = light; -1 = light
        if (v === 1) {
          x = Math.round((c + quietZone) * moduleSize);
          y = Math.round((r + quietZone) * moduleSize);
          w = Math.round((c + quietZone + 1) * moduleSize) - x;
          h = Math.round((r + quietZone + 1) * moduleSize) - y;
          ctx.fillRect(x, y, w, h);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * generate(text, canvasEl, size)
   *
   * @param {string}          text      — The text/URL to encode
   * @param {HTMLCanvasElement} canvasEl — The canvas element to draw on
   * @param {number}          [size=200] — Pixel dimensions of the canvas
   */
  function generate(text, canvasEl, size) {
    if (typeof size !== 'number' || size <= 0) { size = 200; }

    var byteLen  = utf8ByteLength(text);
    var version  = selectVersion(byteLen);
    var dataCW   = buildDataCodewords(text, version);
    var finalCW  = interleaveBlocks(dataCW, version);
    var mat      = buildMatrix(version, finalCW);

    renderToCanvas(mat, canvasEl, size);
  }

  root.MiniQR = { generate: generate };

}(typeof window !== 'undefined' ? window : this));
