import { analyzeCode } from '../src/analyzer';
import fs from 'fs';

describe('React Compiler Analyzer', () => {
  it('detects string refs', () => {
    const code = `
      class MyComponent extends React.Component {
        handleClick() {
          this.refs.myInput.focus();
        }
        render() {
          return <input ref="myInput" />;
        }
      }
    `;
    const filePath = 'test.js';
    fs.writeFileSync(filePath, code);
    const diagnostics = analyzeCode(filePath);
    fs.unlinkSync(filePath);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        message: 'String refs are deprecated and may break React Compiler optimizations.',
        suggestion: 'Replace with useRef hook for functional components or createRef for class components.',
      })
    );
  });

  it('detects Legacy Context', () => {
    const code = `
      class MyComponent extends React.Component {
        static contextTypes = {
          theme: PropTypes.string
        };
      }
    `;
    const filePath = 'test.js';
    fs.writeFileSync(filePath, code);
    const diagnostics = analyzeCode(filePath);
    fs.unlinkSync(filePath);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        message: 'Legacy Context (contextTypes) is deprecated and may cause React Compiler to fail.',
        suggestion: 'Use createContext and contextType or useContext for modern context API.',
      })
    );
  });

  it('detects dynamic object structures', () => {
    const code = `
      function MyComponent() {
        const key = 'dynamic';
        return <div data={{ [key]: true }} />;
      }
    `;
    const filePath = 'test.js';
    fs.writeFileSync(filePath, code);
    const diagnostics = analyzeCode(filePath);
    fs.unlinkSync(filePath);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        message: 'Dynamic object structures (computed keys) in render may prevent React Compiler memoization.',
        suggestion: 'Move dynamic logic to useMemo or extract to a separate function.',
      })
    );
  });

  it('detects unbound this', () => {
    const code = `
      class MyComponent extends React.Component {
        handleClick() {
          console.log(this.props);
        }
        render() {
          return <button onClick={this.handleClick} />;
        }
      }
    `;
    const filePath = 'test.js';
    fs.writeFileSync(filePath, code);
    const diagnostics = analyzeCode(filePath);
    fs.unlinkSync(filePath);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        message: 'Unbound `this` in class methods may lead to runtime errors with React Compiler.',
        suggestion: 'Bind methods in constructor or use arrow functions for class methods.',
      })
    );
  });

  it('detects impure render', () => {
    const code = `
      function MyComponent() {
        fetch('/api');
        return <div />;
      }
    `;
    const filePath = 'test.js';
    fs.writeFileSync(filePath, code);
    const diagnostics = analyzeCode(filePath);
    fs.unlinkSync(filePath);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        message: 'Impure render (fetch in render) violates React Compiler’s purity rules.',
        suggestion: 'Move fetch to useEffect or a separate event handler.',
      })
    );
  });
});