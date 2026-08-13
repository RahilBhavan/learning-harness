#!/usr/bin/env node
import process from "node:process";
import { main } from "../bin/learn.mjs";

main(["generate", ...process.argv.slice(2)]).catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
