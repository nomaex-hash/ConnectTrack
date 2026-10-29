#!/usr/bin/env node
// Xoá MỌI lệnh `console.log(...)` trong assets/scripts bằng TypeScript AST (an toàn với câu lệnh nhiều dòng,
// `if (x) console.log(..)` không ngoặc và arrow function dạng `() => console.log(..)`).
// Giữ nguyên console.warn / console.error / console.info... (log lỗi cần thiết).
//
//   node tools/strip-console-logs.mjs --dry     # chỉ đếm
//   node tools/strip-console-logs.mjs           # áp dụng
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const dry = process.argv.includes('--dry');
const root = join(process.cwd(), 'assets', 'scripts');

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) yield* walk(full);
        else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) yield full;
    }
}

const isConsoleLog = (expr) =>
    ts.isCallExpression(expr)
    && ts.isPropertyAccessExpression(expr.expression)
    && expr.expression.name.text === 'log'
    && ts.isIdentifier(expr.expression.expression)
    && expr.expression.expression.text === 'console';

let total = 0;
let files = 0;
for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('console.log')) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const edits = [];

    const visit = (node) => {
        if (ts.isExpressionStatement(node) && isConsoleLog(node.expression)) {
            const parent = node.parent;
            const inBlockLike = ts.isBlock(parent) || ts.isSourceFile(parent) || ts.isModuleBlock(parent)
                || ts.isCaseClause(parent) || ts.isDefaultClause(parent);
            // Là thân không ngoặc của if/else/for/while: thay bằng `;` (câu lệnh rỗng) để không "nuốt" câu lệnh kế tiếp.
            edits.push({ start: node.getStart(source), end: node.getEnd(), text: inBlockLike ? '' : ';' });
            return; // không đi sâu vào console.log đã xoá
        }
        if (isConsoleLog(node) && !ts.isExpressionStatement(node.parent)) {
            // Dùng như biểu thức (vd `() => console.log(x)`, `a && console.log(x)`): thay bằng `undefined`.
            edits.push({ start: node.getStart(source), end: node.getEnd(), text: 'undefined' });
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    if (edits.length === 0) continue;

    total += edits.length;
    files++;
    console.log(`${String(edits.length).padStart(4)}  ${relative(process.cwd(), file)}`);
    if (dry) continue;

    let out = text;
    for (const e of edits.sort((a, b) => b.start - a.start)) {
        // Xoá luôn dấu xuống dòng + thụt đầu dòng của câu lệnh đã xoá để không để lại dòng trống thừa.
        let start = e.start;
        let end = e.end;
        if (e.text === '') {
            const lineStart = out.lastIndexOf('\n', start - 1) + 1;
            if (out.slice(lineStart, start).trim() === '') start = lineStart;
            if (out[end] === '\r') end++;
            if (out[end] === '\n') end++;
        }
        out = out.slice(0, start) + e.text + out.slice(end);
    }
    writeFileSync(file, out, 'utf8');
}
console.log(`${dry ? 'Sẽ xoá' : 'Đã xoá'} ${total} console.log trong ${files} file.`);
