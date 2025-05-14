#!/usr/bin/env node

const { analyzeDirectory } = require('../lib/index');
const path = require('path');

const targetPath = process.argv[2] || process.cwd();

console.log(`Analyzing code at ${targetPath}...\n`);
const diagnostics = analyzeDirectory(targetPath);

if (diagnostics.length === 0) {
  console.log('No issues found. Your code is likely compatible with React Compiler!');
} else {
  console.log('Diagnostics:');
  diagnostics.forEach((diag) => {
    console.log(`- ${diag.file}:${diag.line}:${diag.column} - ${diag.message}`);
    console.log(`  Suggestion: ${diag.suggestion}\n`);
  });
  console.log(`${diagnostics.length} issue(s) found.`);
}