import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'entrypoint.js',
    output: {
        format: 'cjs',
        dir: 'dist',
        entryFileNames: '[name].cjs'
    },
    plugins: [commonjs(), nodeResolve()]
};
