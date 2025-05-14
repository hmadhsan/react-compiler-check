#!/usr/bin/env node

const { analyzeCode } = require('../lib/index');
const glob = require('glob');
const fs = require('fs');
const path = require('path');

const targetPath = process.argv[2] || './src';
console.log(`Analyzing code at ${targetPath}...\n`);

const files = glob.sync('**/*.{js,jsx,ts,tsx}', { cwd: targetPath, absolute: true });
let allDiagnostics = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const diagnostics = analyzeCode(code);

  // Add file location to diagnostics for better reporting
  allDiagnostics = allDiagnostics.concat(
    diagnostics.map((diag) => ({
      ...diag,
      node: {
        ...diag.node,
        loc: {
          filename: file,
          start: diag.node?.loc?.start || { line: 1, column: 1 },
        },
      },
    }))
  );
}

if (allDiagnostics.length === 0) {
  console.log('No issues found. Your code is likely compatible with React Compiler!');
} else {
  console.log('Diagnostics:');
  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.node && diagnostic.node.loc) {
      console.log(
        `- ${diagnostic.node.loc.filename}:${diagnostic.node.loc.start.line}:${diagnostic.node.loc.start.column} - ${diagnostic.message}`
      );
      console.log(`  Suggestion: ${diagnostic.suggestion}`);
    } else {
      console.log(`- ${diagnostic.message}`);
      console.log(`  Suggestion: ${diagnostic.suggestion}`);
    }
  });
  console.log(`\n${allDiagnostics.length} issue(s) found.`);
}