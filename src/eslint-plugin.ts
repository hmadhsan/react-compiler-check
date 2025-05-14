import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { Rule } from 'eslint';

const rules: { [key: string]: Rule.RuleModule } = {
  'no-legacy-patterns': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Detect patterns that may break React Compiler optimizations',
        recommended: true,
      },
      schema: [],
      messages: {
        legacyPattern: '{{message}}\nSuggestion: {{suggestion}}',
      },
    },
    create(context: Rule.RuleContext): Rule.RuleListener {
      return {
        Program(node: any) {
          const sourceCode = context.getSourceCode().text;
          try {
            const ast: t.File = parse(sourceCode, {
              sourceType: 'module',
              plugins: ['jsx', 'typescript'],
            });

            const diagnostics: any[] = [];

            traverse(ast, {
              MemberExpression(path) {
                if (
                  path.node.object.type === 'ThisExpression' &&
                  t.isIdentifier(path.node.property) &&
                  path.node.property.name === 'refs'
                ) {
                  diagnostics.push({
                    node: path.node,
                    message: 'String refs are deprecated and may break React Compiler optimizations.',
                    suggestion: 'Replace with useRef hook or createRef.',
                  });
                }
              },
              ClassProperty(path) {
                if (
                  t.isIdentifier(path.node.key) &&
                  path.node.key.name === 'contextTypes'
                ) {
                  diagnostics.push({
                    node: path.node,
                    message: 'Legacy Context (contextTypes) is deprecated and may cause React Compiler to fail.',
                    suggestion: 'Use createContext and contextType or useContext.',
                  });
                }
              },
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
                    node: path.node,
                    message: 'Dynamic object structures in render may prevent React Compiler memoization.',
                    suggestion: 'Move dynamic logic to useMemo or extract to a separate function.',
                  });
                }
              },
              ThisExpression(path) {
                const parentFunction = path.findParent(
                  (p) => p.isFunctionDeclaration() || p.isFunctionExpression()
                );
                if (
                  parentFunction &&
                  t.isFunction(parentFunction.node) &&
                  !parentFunction.node.params.some(
                    (param: t.Node) => t.isIdentifier(param) && param.name === 'this'
                  )
                ) {
                  diagnostics.push({
                    node: path.node,
                    message: 'Unbound `this` in class methods may lead to runtime errors with React Compiler.',
                    suggestion: 'Bind methods in constructor or use arrow functions.',
                  });
                }
              },
              CallExpression(path) {
                if (
                  t.isIdentifier(path.node.callee) &&
                  path.node.callee.name === 'fetch' &&
                  path.findParent((p) => p.isJSXElement())
                ) {
                  diagnostics.push({
                    node: path.node,
                    message: 'Impure render (fetch in render) violates React Compiler’s purity rules.',
                    suggestion: 'Move fetch to useEffect or a separate event handler.',
                  });
                }
              },
            });

            diagnostics.forEach((diag) => {
              context.report({
                node,
                loc: diag.node.loc,
                messageId: 'legacyPattern',
                data: {
                  message: diag.message,
                  suggestion: diag.suggestion,
                },
              });
            });
          } catch (error) {
            context.report({
              node,
              message: `Failed to parse file: ${(error as Error).message}`,
              loc: { line: 0, column: 0 },
            });
          }
        },
      };
    },
  },
};

export default {
  rules,
  configs: {
    recommended: {
      plugins: ['react-compiler-check'],
      rules: {
        'react-compiler-check/no-legacy-patterns': 'error',
      },
    },
  },
};