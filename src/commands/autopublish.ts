import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { program as CommanderProgram } from "commander";
import { Console } from "@mekstuff/logreport";
import { execSync } from "child_process";
import { getcommand } from "../lpm.js";

export default class autopublish {
  async GetFiles(): Promise<string[]> {
    const useFiles: string[] = [];
    const tsconfigpath = path.join(process.cwd(), "tsconfig.json");
    const HasTsConfig = fs.existsSync(tsconfigpath);
    if (HasTsConfig) {
      try {
        const rtsconfig = JSON.parse(fs.readFileSync(tsconfigpath, "utf8"));
        if (rtsconfig.compilerOptions && rtsconfig.compilerOptions.outDir) {
          useFiles.push(rtsconfig.compilerOptions.outDir);
          return useFiles;
        }
      } catch (err) {
        Console.warn(err);
      }
    }
    return useFiles;
  }
  async Autopublish(
    files: string[],
    options: { command?: string; requiresImport?: boolean }
  ) {
    if (!files || (files && files.length === 0)) {
      files = await this.GetFiles();
    }
    if (files.length === 0) {
      Console.error(`Specifiy file(s)/directories to watch.`);
    }
    Console.log(`Watching ${files.join(",")}`);
    const watcher = chokidar.watch(files);
    let Debounce: number | undefined;

    watcher.on("change", async (path) => {
      if (Debounce !== undefined) {
        const cd = new Date();
        if (cd.getTime() - Debounce > 500) {
          Debounce = new Date().getTime();
        } else {
          return;
        }
      } else {
        Debounce = new Date().getTime();
      }
      Console.info(path);
      await getcommand("publish").Publish(process.cwd(), {
        scripts: false,
        requiresImport: options.requiresImport,
      });
      if (options.command) {
        execSync(options.command, { stdio: "inherit" });
      }
    });
  }

  build(program: typeof CommanderProgram) {
    program
      .command("autopublish [files...]")
      .description("Automatically publishes on file changes.")
      .option(
        "-c, --command <string>",
        "command to run after successful publish"
      )
      .option("-requires-import [boolean]", "publish --requires-import")
      .action(async (files, options) => {
        await this.Autopublish(files, options);
      });
  }
}
