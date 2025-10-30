import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';  // <--- import this

export default {
  input: 'src/wrappers/einvoice-wrapper.js',
  output: {
    file: 'dist/wrappers/einvoice-wrapper.cjs.js',
    format: 'cjs',
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),  // <--- add this plugin here
  ],
};

