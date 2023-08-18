import fs from "fs";
import path from "path";
import enqpkg from "enquirer";
import { Console } from "@mekstuff/logreport";
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
    Console.assert(typeof directory === "string", "directory must be a string");
    Console.assert(typeof command === "string", "directory must be a string");
    if (whitelist) {
      Console.assert(
        typeof whitelist === "string",
        "whitelist must be a string"
      );
    }
    if (!fs.statSync(directory).isDirectory()) {
      Console.error(directory + " is not a directory.");
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
          Console.log("Skipping => " + child);
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
