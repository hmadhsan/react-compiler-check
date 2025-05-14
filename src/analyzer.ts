import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs';
import path from 'path';

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion: string;
}

export function analyzeCode(filePath: string): Diagnostic[] {
  const code = fs.readFileSync(filePath, 'utf-8');
  const diagnostics: Diagnostic[] = [];

  try {
    const ast: t.File = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      // Detect string refs (e.g., this.refs.myInput)
      MemberExpression(path) {
        if (
          path.node.object.type === 'ThisExpression' &&
          t.isIdentifier(path.node.property) &&
          path.node.property.name === 'refs'
        ) {
          diagnostics.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'String refs are deprecated and may break React Compiler optimizations.',
            suggestion: 'Replace with useRef hook for functional components or createRef for class components.',
          });
        }
      },
      // Detect Legacy Context (e.g., contextTypes)
      ClassProperty(path) {
        if (
          t.isIdentifier(path.node.key) &&
          path.node.key.name === 'contextTypes'
        ) {
          diagnostics.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Legacy Context (contextTypes) is deprecated and may cause React Compiler to fail.',
            suggestion: 'Use createContext and contextType or useContext for modern context API.',
          });
        }
      },
      // Detect dynamic object structures (e.g., computed keys in render)
      ObjectExpression(path) {
        if (
          path.findParent((p) => p.isJSXElement()) &&
          path.node.properties.some(
            (prop) =>
              t.isObjectProperty(prop) &&
              t.isExpression(prop.key) &&
              prop.computed
          )
        ) {
          diagnostics.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Dynamic object structures (computed keys) in render may prevent React Compiler memoization.',
            suggestion: 'Move dynamic logic to useMemo or extract to a separate function.',
          });
        }
      },
      // Detect unbound this usage
      ThisExpression(path) {
        const parentMethod = path.findParent(
          (p) =>
            p.isClassMethod() || // Include class methods
            p.isFunctionDeclaration() ||
            p.isFunctionExpression()
        );
        if (
          parentMethod &&
          (t.isClassMethod(parentMethod.node) ||
            t.isFunctionDeclaration(parentMethod.node) ||
            t.isFunctionExpression(parentMethod.node)) &&
          !parentMethod.node.params.some(
            (param: t.Node) => t.isIdentifier(param) && param.name === 'this'
          ) &&
          path.findParent((p) => p.isClassDeclaration()) // Ensure within a class
        ) {
          diagnostics.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Unbound `this` in class methods may lead to runtime errors with React Compiler.',
            suggestion: 'Bind methods in constructor or use arrow functions for class methods.',
          });
        }
      },
      // Detect impure render (e.g., fetch in render)
      CallExpression(path) {
        if (
          t.isIdentifier(path.node.callee) &&
          path.node.callee.name === 'fetch' &&
          path.findParent(
            (p) =>
              p.isFunctionDeclaration() ||
              p.isFunctionExpression() ||
              p.isArrowFunctionExpression() // Include functional components
          ) &&
          path.findParent((p) => p.isJSXElement()) // Ensure in render path
        ) {
          diagnostics.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Impure render (fetch in render) violates React Compiler’s purity rules.',
            suggestion: 'Move fetch to useEffect or a separate event handler.',
          });
        }
      },
    });
  } catch (error) {
    diagnostics.push({
      file: filePath,
      line: 0,
      column: 0,
      message: `Failed to parse file: ${(error as Error).message}`,
      suggestion: 'Ensure valid JavaScript/JSX syntax.',
    });
  }

  return diagnostics;
}

export function analyzeDirectory(dirPath: string): Diagnostic[] {
  let diagnostics: Diagnostic[] = [];
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      diagnostics = diagnostics.concat(analyzeDirectory(fullPath));
    } else if (
      fullPath.endsWith('.js') ||
      fullPath.endsWith('.tsx') ||
      fullPath.endsWith('.jsx')
    ) {
      diagnostics = diagnostics.concat(analyzeCode(fullPath));
    }
  }

  return diagnostics;
}