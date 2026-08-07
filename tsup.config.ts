import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "isWebBiometricsSupported",
  dts: false,
  clean: true,
  minify: true,
  sourcemap: false,
  target: "es2020",
  removeNodeProtocol: false,
});