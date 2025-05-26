import { parse } from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import * as t from '@babel/types'

interface Diagnostic {
  node: any
  message: string
  suggestion: string
}

export function analyzeCode(code: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  const isReactComponent = (
    path: NodePath<
      t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
    >
  ): boolean => {
    const node = path.node
    if (t.isArrowFunctionExpression(node) && !t.isBlockStatement(node.body)) {
      return t.isJSXElement(node.body) || t.isJSXFragment(node.body)
    }
    return (
      t.isBlockStatement(node.body) &&
      node.body.body.some(
        (stmt: t.Statement) =>
          t.isReturnStatement(stmt) &&
          stmt.argument &&
          (t.isJSXElement(stmt.argument) || t.isJSXFragment(stmt.argument))
      )
    )
  }

  const isCustomHook = (
    path: NodePath<
      t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
    >
  ): boolean => {
    if (!path) return false

    if (t.isFunctionDeclaration(path.node) && path.node.id?.name.startsWith('use')) {
      return true
    }

    if (
      (t.isFunctionExpression(path.node) || t.isArrowFunctionExpression(path.node)) &&
      path.parentPath &&
      path.parentPath.isVariableDeclarator() &&
      t.isIdentifier(path.parentPath.node.id) &&
      path.parentPath.node.id.name.startsWith('use')
    ) {
      return true
    }

    return false
  }

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    })

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
            suggestion: 'Replace with useRef hook or createRef for class components.',
          })
        }
      },

      ClassProperty(path) {
        if (t.isIdentifier(path.node.key) && path.node.key.name === 'contextTypes') {
          diagnostics.push({
            node: path.node,
            message: 'Legacy Context (contextTypes) is deprecated and may cause React Compiler to fail.',
            suggestion: 'Use createContext and useContext for modern context API.',
          })
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
          })
        }
      },

      ThisExpression(path) {
        const parentFunction = path.findParent(
          (p) =>
            p.isFunctionDeclaration() ||
            p.isFunctionExpression() ||
            (p.isClassMethod() && p.node.kind === 'method') ||
            p.isArrowFunctionExpression()
        )
        if (
          parentFunction &&
          !t.isArrowFunctionExpression(parentFunction.node) &&
          (t.isFunctionDeclaration(parentFunction.node) ||
            t.isFunctionExpression(parentFunction.node) ||
            t.isClassMethod(parentFunction.node)) &&
          !parentFunction.node.params.some(
            (param) =>
              t.isIdentifier(param) &&
              param.typeAnnotation &&
              t.isTSThisType(param.typeAnnotation)
          )
        ) {
          diagnostics.push({
            node: path.node,
            message: 'Unbound `this` in class methods may lead to runtime errors with React Compiler.',
            suggestion: 'Bind methods in constructor or use arrow functions for class methods.',
          })
        }
      },

      CallExpression(path) {
        const hookNames = [
          'useState',
          'useEffect',
          'useContext',
          'useReducer',
          'useCallback',
          'useMemo',
          'useRef',
        ]

        if (
          t.isIdentifier(path.node.callee) &&
          hookNames.includes(path.node.callee.name)
        ) {
          const parentFunc = path.findParent(
            (p) =>
              p.isFunctionDeclaration() ||
              p.isFunctionExpression() ||
              p.isArrowFunctionExpression()
          ) as NodePath<
            t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
          > | null

          const isTopLevel =
            parentFunc &&
            !path.findParent((p) => p.isIfStatement()) &&
            !path.findParent((p) => p.isForStatement()) &&
            !path.findParent((p) => p.isWhileStatement()) &&
            !path.findParent(
              (p) =>
                (p.isFunctionDeclaration() ||
                  p.isFunctionExpression() ||
                  p.isArrowFunctionExpression()) &&
                p !== parentFunc
            )

          if (parentFunc && !isTopLevel) {
            diagnostics.push({
              node: path.node,
              message: `Hook ${path.node.callee.name} is called inside a loop, condition, or nested function, violating React rules.`,
              suggestion: 'Move the hook call to the top level of your component or custom hook.',
            })
          }

          const isInsideReactComponent = parentFunc && isReactComponent(parentFunc)
          const isInsideCustomHook = parentFunc && isCustomHook(parentFunc)

          if (!isInsideReactComponent && !isInsideCustomHook) {
            diagnostics.push({
              node: path.node,
              message: `Hook ${path.node.callee.name} is called outside a React component or custom hook, violating React rules.`,
              suggestion: 'Ensure hooks are only called in React function components or custom hooks.',
            })
          }
        }
      },

      AssignmentExpression(path) {
        if (
          t.isMemberExpression(path.node.left) &&
          t.isIdentifier(path.node.left.object) &&
          (path.node.left.object.name === 'state' ||
            path.node.left.object.name.toLowerCase().includes('state') ||
            path.node.left.object.name.toLowerCase().includes('obj'))
        ) {
          const parentFunc = path.findParent(
            (p) =>
              p.isFunctionDeclaration() ||
              p.isFunctionExpression() ||
              p.isArrowFunctionExpression()
          ) as NodePath<
            t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
          > | null

          const isReactComponentFunc = parentFunc && isReactComponent(parentFunc)
          if (isReactComponentFunc) {
            diagnostics.push({
              node: path.node,
              message: 'Direct state mutation detected. This may break reactivity and React Compiler expectations.',
              suggestion: 'Use setState or immutability helpers instead of mutating state directly.',
            })
          }
        }
      },
    })
  } catch (e) {
    console.error('Failed to parse file:', e)
  }

  return diagnostics
}