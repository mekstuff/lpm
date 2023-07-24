#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Command } from "commander";
import logreport from "./utils/logreport.js";
import { execSync } from "child_process";

const GetNodeModules = () => {
  return path.resolve("node_modules");
};

const program = new Command();
program.helpOption("-H, --HELP");
program
  .allowUnknownOption(true)
  // .option("-n, --node", "Pass node flags.")
  .description("For running binaries.");

program.action(async () => {
  const Flags: string[] = [];
  process.argv.forEach((v, i) => {
    if (i > 1 && v.match("^-")) {
      // if (v !== "-n" && v !== "--node") {
      Flags.push(v);
      // }
    }
  });

  const nm = GetNodeModules();
  const binary = process.argv[2];
  if (typeof binary !== "string") {
    logreport.error("Invalid binary name => " + binary);
  }
  let res: string | undefined;
  const IsExecutablePath = path.extname(binary) === "" ? false : true;
  if (!IsExecutablePath) {
    if (!fs.existsSync(nm)) {
      logreport.error("node_modules not found in directory. => " + nm);
      process.exit(1);
    }
    const BinPath = path.join(nm, ".bin");
    if (!fs.existsSync(BinPath)) {
      logreport.error(`"${binary}" was not found`);
      process.exit(1);
    }
    const filePath = path.join(BinPath, binary + ".cmd");
    if (!fs.existsSync(filePath)) {
      logreport.error(`"${binary}" was not found`);
      process.exit(1);
    }
    try {
      const fr = fs.readFileSync(filePath, "utf8");
      const executableRes = fr.match(/node\s+"%~dp0\\(.+)"/);
      if (!executableRes) {
        logreport.error(
          "Could not get executable path from bin source. Got null."
        );
        process.exit(1);
      }
      res =
        executableRes[1] &&
        path.resolve(path.join("node_modules", "_", executableRes[1])); //have to add _ to join because for some reason it doesn't include node_modules if it's the only argument passed.
      if (!res) {
        logreport.error(executableRes);
        process.exit(1);
      }
    } catch (e) {
      logreport.error("Something went wrong => " + e);
    }
  } else {
    res = binary;
  }

  const cmd = `node --preserve-symlinks --preserve-symlinks-main ${res} ${Flags.join(
    " "
  )}`;
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    logreport.error("Command failed " + e);
    process.exit(1);
  }
});

program.parse();
