import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "isWebBiometricsSupported",
  dts: false, // los tipos se generan aparte con tsc
  clean: true,
  minify: true,
  sourcemap: false,
  target: "es2020",
});