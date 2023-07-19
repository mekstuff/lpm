import { program as CommanderProgram } from "commander";
import logreport from "../utils/logreport.js";
import { ReadLockFileFromCwd } from "../utils/lpmfiles.js";
import { ReadPackageJSON, WritePackageJSON } from "../utils/PackageReader.js";
import enqpkg from "enquirer";
import chalk from "chalk";
const { prompt } = enqpkg;
import LogTree, { Tree } from "console-log-tree";

export default class preprare {
  async Prepare(
    Options: { production?: boolean; dev?: boolean },
    packageDirectory?: string
  ) {
    packageDirectory = packageDirectory || process.cwd();
    if (Options.production && Options.dev) {
      logreport.error(
        "Both `--production` & `--dev` flags cannot be set while calling `prepare`."
      );
    }
    if (!Options.production && !Options.dev) {
      logreport.error(
        "Must provide either `--production` or `--dev` flag set when calling `prepare`."
      );
    }
    const LockFile = await ReadLockFileFromCwd(packageDirectory, true);
    if (LockFile === undefined) {
      return;
    }
    const PackageFile = await ReadPackageJSON(packageDirectory);
    if (
      !PackageFile.success ||
      typeof PackageFile.result === "string" ||
      PackageFile.result === undefined
    ) {
      return logreport.error("Could not access package.json");
    }
    const tree: Tree[] = [];
    const subTreeChildren: Tree[] = [];

    PackageFile.result.dependencies = PackageFile.result.dependencies || {};
    if (Options.production) {
      for (const lockpkg in LockFile.pkgs) {
        const pkgjson = await ReadPackageJSON(LockFile.pkgs[lockpkg].resolve);
        if (pkgjson.success === false && typeof pkgjson.result === "string") {
          logreport.error(
            `Could not access package.json for published packge "${lockpkg}" => ${pkgjson.result}`
          );
        }

        if (!pkgjson.result || typeof pkgjson.result === "string") {
          logreport.error("Something went wrong.");
          return;
        }

        if (pkgjson.result.version === undefined) {
          logreport.error(
            `Published package does not have "version" field. => ${lockpkg} => ${LockFile.pkgs[lockpkg].resolve}`
          );
        }
        subTreeChildren.push({
          name: `${chalk.green(lockpkg)} => ${chalk.green(
            "^" + pkgjson.result.version
          )}`,
        });
        PackageFile.result.dependencies[lockpkg] = ("^" +
          pkgjson.result.version) as string;
      }
    } else {
      for (const lockpkg in LockFile.pkgs) {
        subTreeChildren.push({
          name: `${chalk.green(lockpkg)} ✓`,
        });
        PackageFile.result.dependencies[lockpkg] =
          "link:" + LockFile.pkgs[lockpkg].resolve;
      }
    }
    tree.push({
      name: PackageFile.result.name as string,
      children: subTreeChildren,
    });
    const prefix = Options.production
      ? "Ready For Production 🚀"
      : "Ready For Development 🚧";
    logreport(prefix + "\n" + LogTree.parse(tree));
    await WritePackageJSON(
      packageDirectory,
      JSON.stringify(PackageFile.result, null, 2)
    );
  }
  build(program: typeof CommanderProgram) {
    program
      .command("prepare")
      .description("Updates dependencies to fit that target build.")
      .option("-p, --production", "Prepare for production.")
      .option("-d, --dev", "Prepare for dev.")
      .action((options) => {
        this.Prepare(options);
      })
      .command("safe-production")
      .option(
        "-w, --warn [boolean]",
        "Warn if local registry dependencies are being used instead of prompting for change."
      )
      .option(
        "-e, --error [boolean]",
        "Error if local registry dependencies are being used instead of prompting for change."
      )
      .description(
        "Makes sure that no development dependencies are in package.json, if there's any it prompt to prepare for production."
      )
      .action(async (Options: { warn?: boolean; error?: boolean }) => {
        const LockFile = await ReadLockFileFromCwd(undefined, true);
        if (LockFile === undefined) {
          process.exit();
        }
        const PackageJSON = await ReadPackageJSON(process.cwd());
        if (!PackageJSON.success || typeof PackageJSON.result === "string") {
          return logreport.error("Could not read package.json");
        }

        const InDevModePackages: string[] = [];
        for (const pkg in LockFile.pkgs) {
          const InJSON = PackageJSON.result?.dependencies?.[pkg];
          if (InJSON === "link:" + LockFile.pkgs[pkg].resolve) {
            InDevModePackages.push(InJSON);
          }
        }
        if (InDevModePackages.length > 0) {
          const msg =
            InDevModePackages.length +
            " " +
            ((InDevModePackages.length > 1 && "dependencies are") ||
              "dependency is") +
            ` using local registry files.\n\n${InDevModePackages.join("\n")}`;
          if (Options.error) {
            logreport.error(msg);
            return;
          }
          if (Options.warn) {
            logreport.warn(msg);
            return;
          }
          await prompt<{ run_safe: boolean }>({
            name: "run_safe",
            initial: true,
            message: msg + "\n\nShould we prepare for production?",
            type: "confirm",
          })
            .then(async (res) => {
              if (res.run_safe) {
                await this.Prepare({ production: true });
                logreport(
                  "Run `lpm prepare --development` when you finish publishing/pushing your package to switch back to local registry dependencies.",
                  "log",
                  true
                );
              } else {
                logreport.error(
                  "Package not ready for production. run `lpm prepare --production`"
                );
              }
            })
            .catch((err) => {
              logreport.error(
                "Package not ready for production. run `lpm prepare --production`\n\n" +
                  err
              );
            });
        } else {
          logreport(
            "Your package 📦 is already ready for production 🚀",
            "log",
            true
          );
        }
        // PackageJSON.result?.dependencies
        // PackageJSON.result.console.log(LockFile);
      });
  }
}
