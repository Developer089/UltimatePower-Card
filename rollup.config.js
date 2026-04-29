import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const dev = process.env.ROLLUP_WATCH === 'true';

export default {
  input: 'src/ultimate-power-card.ts',
  output: {
    file: 'dist/ultimate-power-card.js',
    format: 'es',
    sourcemap: dev,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
    !dev && terser({ format: { comments: false } }),
  ].filter(Boolean),
};
