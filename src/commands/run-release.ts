import fs from "fs";
import tar from "tar";
import path from "path";
import enqpkg from "enquirer";
const { prompt } = enqpkg;
import { program as CommanderProgram } from "commander";
import {
  CreateTemporaryFolder,
  GetLPMPackagesDirectory,
} from "../utils/lpmfiles.js";
import logreport from "../utils/logreport.js";
import { PackageFile, ReadPackageJSON } from "../utils/PackageReader.js";
import chalk from "chalk";
import { execSync } from "child_process";
import { getcommand } from "../lpm.js";

export default class runrelease {
  async RunRelease(
    scope: string,
    options: { command?: string; warnErrors?: boolean }
  ) {
    options.command = options.command || "npm publish tarbal.tgz --no-scripts";
    scope = "@" + scope;
    const LPMPackageDirectory = await GetLPMPackagesDirectory();
    const targetScopePath = path.join(LPMPackageDirectory, scope);
    if (!fs.existsSync(targetScopePath)) {
      logreport.error(
        `Could not resolve scope "${scope}". The path does not exist => "${targetScopePath}"`
      );
      return;
    }
    const dirItems = fs.readdirSync(targetScopePath);
    const res = await prompt<{ items: string[] }>({
      name: "items",
      type: "multiselect",
      message: "Select packages",
      choices: dirItems.map((item) => {
        return {
          name: scope + "/" + item,
        };
      }),
    }).catch((e) => {
      logreport.error(e);
      process.exit(1);
    });
    logreport("Verifying packages...", "log", true);
    const pubinfo: {
      packagejson: PackageFile;
      tarbal: string;
      path: string;
    }[] = [];
    for (const x of res.items) {
      try {
        const tpath = path.join(LPMPackageDirectory, x);
        const tarbalPath = path.join(tpath, "tarbal.tgz");
        if (!fs.existsSync(tarbalPath)) {
          throw new Error("Could not resolve tarbal file.");
        }
        const { success, result } = await ReadPackageJSON(
          path.join(tpath, "pkg")
        );
        if (success === false) {
          throw new Error(
            "Could not successfully read package.json file at => " +
              path.join(tpath, "pkg", "package.json") +
              " because " +
              result
          );
        }
        pubinfo.push({
          packagejson: result as Partial<PackageFile>,
          tarbal: tarbalPath,
          path: tpath,
        });
      } catch (e) {
        logreport.error(`Something wen't wrong with package "${x}". => ${e}`);
        process.exit(1);
      }
    }
    logreport(
      pubinfo.length + "/" + res.items.length + " packages verified.",
      "log",
      true
    );
    console.log(
      "\n" +
        pubinfo
          .map((x) => {
            return `${
              x.packagejson.name
                ? chalk.blueBright(x.packagejson.name)
                : chalk.red("!!NO NAME field in package.json!!")
            } => ${
              x.packagejson.version
                ? chalk.green(x.packagejson.version)
                : chalk.red("!!NO VERSION field in package.json!!")
            }`;
          })
          .join("\n") +
        "\n"
    );
    const commandprompt = await prompt<{ cmd: string }>({
      name: "cmd",
      type: "input",
      message: "Command to execute",
      initial: options.command,
    }).catch((e) => {
      logreport.error(e);
      process.exit(1);
    });
    const temp = await CreateTemporaryFolder();
    for (const x of pubinfo) {
      try {
        const bn = path.basename(x.path);
        const tempPath = path.join(temp.path, bn);
        /**
         * We copy the published file since we perform changes before publishing to registry, we don't want these changes to
         * trigger recompiling to packages that have it installed
         *
         * Also we can just remove it after instead of trying to revert changes.
         */
        fs.cpSync(x.path, tempPath, {
          recursive: true,
        });
        /**
         * Prepare for production
         */
        const PrepareCommand = getcommand("prepare");
        await PrepareCommand.Prepare(
          {
            production: true,
          },
          path.join(tempPath, "pkg")
        );

        /**
         * Remove lpm.lock from temp package.
         */
        if (fs.existsSync(path.join(tempPath, "pkg", "lpm.lock"))) {
          fs.rmSync(path.join(tempPath, "pkg", "lpm.lock"));
        }
        /**
         * We rename to 'package' from 'pkg' to match npm pack, this probably isn't needed.
         */
        fs.renameSync(
          path.join(tempPath, "pkg"),
          path.join(tempPath, "package")
        );
        /**
         * Archive
         */
        tar.c(
          {
            cwd: tempPath,
            file: path.resolve(path.join(tempPath, "publish.tgz")),
            sync: true,
          },
          ["package"]
        );

        /**
         * Remove the `lpm.lock` from the temp file so it doesn't publish it.
         */
        if (options.command && options.command !== "") {
          execSync(commandprompt.cmd, { cwd: tempPath, stdio: "inherit" });
        }
      } catch (e) {
        const err = `Failed to execute "${commandprompt.cmd}" on ${x.packagejson.name}. => ${e}`;
        if (options.warnErrors) {
          logreport(err, "warn", true);
        } else {
          temp.done();
          logreport.error(err);
          process.exit(1);
        }
      }
    }
    temp.done();
  }

  build(program: typeof CommanderProgram) {
    program
      .command("run-release <scope>")
      .option(
        "-c, --command",
        "The publish command to execute on each tarbal. The publish ready tarbal is stored as 'publish.tgz'",
        "echo ''"
        // "npm publish publish.tgz --no-scripts"
      )
      .option(
        "--warn-errors",
        "Warns any registry publish errors and moves on to the next instead of exiting process.",
        false
      )
      .description(
        "For publishing/releasing local published packages to a registry"
      )
      .action(async (scope, options) => {
        await this.RunRelease(scope, options);
      });
  }
}
