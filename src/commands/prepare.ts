import { program as CommanderProgram } from "commander";
import logreport from "../utils/logreport.js";
import { ReadLockFileFromCwd } from "../utils/lpmfiles.js";
import { ReadPackageJSON, WritePackageJSON } from "../utils/PackageReader.js";
import enqpkg from "enquirer";
import chalk from "chalk";
const { prompt } = enqpkg;

export default class preprare {
  async Prepare(Options: { production?: boolean; dev?: boolean }) {
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
    const LockFile = await ReadLockFileFromCwd();
    const PackageFile = await ReadPackageJSON(process.cwd());
    if (
      !PackageFile.success ||
      typeof PackageFile.result === "string" ||
      PackageFile.result === undefined
    ) {
      return logreport.error("Could not access package.json");
    }
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

        logreport(
          `${chalk.green(lockpkg)} => ${chalk.green(
            PackageFile.result.version
          )}`
        );
        PackageFile.result.dependencies[lockpkg] = PackageFile.result
          .version as string;
      }
      logreport("Ready For Production 🚀", "log", true);
    } else {
      for (const lockpkg in LockFile.pkgs) {
        PackageFile.result.dependencies[lockpkg] =
          "link:" + LockFile.pkgs[lockpkg].resolve;

        logreport("Ready For Development 🚧", "log", true);
      }
    }
    await WritePackageJSON(
      process.cwd(),
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
      .description(
        "Makes sure that no development dependencies are in package.json, if there's any it prompt to prepare for production."
      )
      .action(async () => {
        const LockFile = await ReadLockFileFromCwd();
        const PackageJSON = await ReadPackageJSON(process.cwd());
        if (!PackageJSON.success || typeof PackageJSON.result === "string") {
          return logreport.error("Could not read package.json");
        }

        const InDevModePackages: string[] = [];
        for (const pkg in LockFile.pkgs) {
          const InJSON = PackageJSON.result?.dependencies?.[pkg];
          if (InJSON === LockFile.pkgs[pkg].resolve) {
            InDevModePackages.push(InJSON);
          }
        }
        if (InDevModePackages.length > 0) {
          await prompt<{ run_safe: boolean }>({
            name: "run_safe",
            initial: true,
            message: `${InDevModePackages.length} ${
              (InDevModePackages.length > 1 && "dependencies are") ||
              "dependency is"
            } using local registry files, Should we prepare for production?\n\n${InDevModePackages.join(
              "\n"
            )}\n\n`,
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
        }
        // PackageJSON.result?.dependencies
        // PackageJSON.result.console.log(LockFile);
      });
  }
}
