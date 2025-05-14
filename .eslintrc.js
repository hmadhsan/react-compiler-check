module.exports = {
  plugins: ['react-compiler-check'],
  rules: {
    'react-compiler-check/no-legacy-patterns': 'error',
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
};