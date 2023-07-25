#!/usr/bin/env node

import { Command } from "commander";
import commands from "./commands/index.js";
import { ReadLockFileFromCwd } from "./utils/lpmfiles.js";
import { AddOptions } from "./commands/add-link.js";
import logreport from "./utils/logreport.js";

const program = new Command();

const cmdClasses = new Map();

program
  .allowUnknownOption(true)
  .option("-pm, --package-manager [string]", "The package manager to use.")
  .option("--show-pm-logs", "Show package managers output in terminal.");

program.action(async (Options: AddOptions) => {
  const Flags: string[] = [];
  process.argv.forEach((v, i) => {
    if (i > 1 && v.match("^-")) {
      Flags.push(v);
    }
  });

  if (Flags.length === 0 && process.argv.length > 2) {
    program.help();
    return;
  }
  const LockFile = await ReadLockFileFromCwd();
  const pkgs = LockFile.pkgs;
  let ToCallInstall: string[] = [];
  for (const Package in pkgs) {
    ToCallInstall.push(Package);
  }

  if (ToCallInstall.length === 0) {
    return logreport("Nothing to install.", "log", true);
  }

  ToCallInstall = [...ToCallInstall, ...Flags];

  getcommand("add").Add(ToCallInstall, Options);
  // execSync(`lpm add ${ToCallInstall.join(" ")}`)
});
/**
 * Initializes the CLI.
 */
async function init() {
  Object.entries(commands).forEach((object) => {
    const c = new object[1].default();
    c.build(program);
    cmdClasses.set(object[0], c);
  });
  program.parse();
}

export function getcommand(command: string) {
  return cmdClasses.get(command);
}

init().catch((e) => {
  console.error("init failed ", e);
  process.exitCode = 1;
});
