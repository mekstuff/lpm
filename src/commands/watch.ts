import fs from "fs";
import path from "path";
import chalk from "chalk";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import { execSync } from "child_process";

export default class watch {
  async watch(files: string[], options: { command?: string }) {
    if (!files || (files && files.length === 0)) {
      files = [];
      const cwd = process.cwd();
      try {
        const tsconfigpath = path.join(cwd, "tsconfig.json");
        if (fs.existsSync(tsconfigpath)) {
          const data = JSON.parse(fs.readFileSync(tsconfigpath, "utf8"));
          if (data.compilerOptions && data.compilerOptions.outDir) {
            files.push(data.compilerOptions.outDir);
          } else {
            logreport.warn("No outDir was specified in tsconfig.");
          }
        }
      } catch (err) {
        logreport.error(
          "Something went wrong when trying to automatically get files to watch. => " +
            err
        );
      }
    }
    logreport(
      `${chalk.blue("Watching with")} ${chalk.green("Chokidar")}. ${chalk.red(
        "Must be installed globally."
      )}`
    );
    const c = options.command || "lpm publish --no-scripts";
    execSync(`Chokidar ${files.join(" ")} -c="${c}"`, { stdio: "inherit" });
  }
  build(program: typeof CommanderProgram) {
    program
      .command("watch [files...]")
      .option("-c,--command [string]", "Execute a custom command instead.")
      .description(
        "Watches files with chokidar and runs the publish command with no scripts unless overidden"
      )
      .action(async (files, Options) => {
        await this.watch(files, Options);
      });
  }
}
