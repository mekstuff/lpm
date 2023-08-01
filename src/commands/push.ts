import { program as CommanderProgram } from "commander";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import logreport from "../utils/logreport.js";
import { ReadLPMPackagesJSON } from "../utils/lpmfiles.js";
import chalk from "chalk";
import { getcommand } from "../lpm.js";
import pluralize from "pluralize";

export default class push {
  async Push(
    cwd: string | undefined,
    options: {
      Log?: boolean;
      scripts?: boolean;
      force?: boolean;
      requiresImport?: boolean;
    },
    CaptureNotPublished?: boolean
  ) {
    if (typeof cwd !== "string") {
      cwd = process.cwd();
    }
    const PackageJSON = await ReadPackageJSON(cwd);
    if (!PackageJSON.success || typeof PackageJSON.result === "string") {
      logreport.error("Could not read package. => " + PackageJSON.result);
      process.exit(1);
    }
    const name = PackageJSON.result.name;
    if (!name) {
      logreport.error("Package does not have a name.");
      process.exit(1);
    }
    // const ALL_DEPS = await GetAllDependantsOfPackage(
    //   PackageJSON.result,
    //   new Map(),
    //   cwd
    // );
    // const x = true;
    // if (x === true) {
    //   process.exit();
    // }
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const pkg = LPMPackagesJSON.packages[name];
    if (!pkg) {
      if (CaptureNotPublished) {
        return;
      }
      logreport.error(`${name} is not published.`);
      process.exit(1);
    }
    const OLD_PUBLISH_SIG = pkg.publish_sig;
    const NEW_PUBLISH_SIG = await getcommand("publish").Publish(cwd, {
      scripts: options.scripts,
      requiresImport: options.requiresImport,
      log: options.Log,
    });
    if (OLD_PUBLISH_SIG === NEW_PUBLISH_SIG && !options.force) {
      logreport("Nothing changed.", "log", true);
      process.exit();
    }
    logreport.Elapse(
      `${chalk.green(name)} is installed in ${chalk.green(
        pkg.installations.length
      )} ${pluralize("directory", pkg.installations.length)}...`,
      "PUSH"
    );

    let Total_Updated = 0;
    let Total_Ran = 0;
    await new Promise<void>(async (resolve) => {
      pkg.installations.forEach(async (installation) => {
        try {
          await getcommand("pull").Pull(name, {
            Cwd: installation,
            Log: options.Log,
          });
          await this.Push(installation.path, options, true);
          Total_Updated++;
        } catch (e) {
          logreport.warn(
            `Failed to push to directory "${installation}". => ${e}`
          );
        }
        Total_Ran++;
        if (Total_Ran === pkg.installations.length) {
          resolve();
        }
      });
    });

    logreport.Elapse(
      `${chalk.green(
        `[${Total_Updated}/${pkg.installations.length}]`
      )} ${pluralize("package", Total_Updated)} successfully updated.`,
      "PUSH",
      true
    );
  }
  build(program: typeof CommanderProgram) {
    program
      .command("push [cwd]")
      .option("-log [boolean]", "Log command process.", false)
      .option("--no-scripts [boolean]", "Does not run any scripts")
      .option(
        "-f, --force [boolean]",
        "Forces the publish even if nothing was changed."
      )
      .option(
        "--requires-import [boolean]",
        "For the package to be installed it must be used as an imported package."
      )
      .description(
        "Publishes the package then updates all other packages that has it installed."
      )
      .action(async (cwd, options) => {
        await this.Push(cwd, options);
      });
  }
}
