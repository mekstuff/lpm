import fs from "fs";
import path from "path";
import enqpkg from "enquirer";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import { execSync } from "child_process";
const { prompt } = enqpkg;

interface bulkOptions {
  verify?: boolean;
}

export default class Bulk {
  async bulk(
    directory: string,
    command: string,
    whitelist: string | undefined,
    options: bulkOptions
  ) {
    logreport.assert(
      typeof directory === "string",
      "directory must be a string"
    );
    logreport.assert(typeof command === "string", "directory must be a string");
    if (whitelist) {
      logreport.assert(
        typeof whitelist === "string",
        "whitelist must be a string"
      );
    }
    if (!fs.statSync(directory).isDirectory()) {
      logreport.error(directory + " is not a directory.");
      process.exit(1);
    }
    for (const child of fs.readdirSync(directory)) {
      if (options.verify) {
        const res = await prompt<{ Verify: string }>({
          name: "Verify",
          message: "Verify => " + child,
          type: "text",
          initial: command,
        });
        if (res.Verify === "false" || res.Verify === "n") {
          logreport("Skipping => " + child);
          continue;
        } else {
          command = res.Verify;
        }
      }
      execSync(command, { cwd: path.join(directory, child), stdio: "inherit" });
    }
  }
  build(program: typeof CommanderProgram) {
    program
      .command("bulk <directory> <command> [whitelist]")
      .option(
        "--verify",
        "Prompts to verify running command on each file first",
        false
      )
      .description("Run a command against all files within a given directory")
      .action(async (directory, command, whitelist, options) => {
        await this.bulk(directory, command, whitelist, options);
      });
  }
}
