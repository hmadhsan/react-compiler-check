# react-compiler-check

A CLI tool to ensure your React code is compatible with **React Compiler** by detecting patterns that violate React rules or cause issues with memoization and optimizations.

## Features

- Detects legacy patterns (e.g., string refs, Legacy Context) that break React Compiler.
- Flags impure renders (e.g., `fetch`, `setTimeout` in render).
- Identifies improper hook usage (e.g., hooks in loops, conditions, or outside React components).
- Catches direct state mutations and dynamic objects that prevent memoization.
- Provides actionable suggestions to fix issues.

## Installation

Install the package globally or locally via npm:

```bash
npm install -g react-compiler-check
```

#### Or install it in your project:

```bash
npm install react-compiler-check
```

## Usage
Run the CLI on your project’s source directory:

```bash
npx react-compiler-check ./src
```

- The tool scans all .js, .jsx, .ts, and .tsx files in the specified directory.

- If no path is provided, it defaults to ./src.

## Example Output
### Given a file with issues:

``` bash
function notAComponent() {
  const [count] = useState(0);
}

const App: React.FC = () => {
  setTimeout(() => console.log('Impure!'), 1000);
  return <div />;
};
```
### Running the tool:

``` bash
npx react-compiler-check ./src
```

### Output:
```bash
Analyzing code at ./src...

Diagnostics:
- src/App.tsx:2:16 - Hook useState is called outside a React component or custom hook, violating React rules.
  Suggestion: Ensure hooks are only called in React function components or custom hooks.
- src/App.tsx:6:3 - Impure render (setTimeout in render) violates React Compiler’s purity rules.
  Suggestion: Move setTimeout to useEffect or a separate event handler.

2 issue(s) found.
```

## Contributing

#### Fork the repository: https://github.com/hmadhsan/react-compiler-check

#### Create a feature branch: git checkout -b feature/new-check

#### Commit your changes: git commit -m "Add new check for X"

#### Push to the branch: git push origin feature/new-check

#### Open a pull request.

## License
MIT License. See LICENSE for details.





