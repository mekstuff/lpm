import { program as CommanderProgram } from "commander";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import logreport from "../utils/logreport.js";
import { ReadLPMPackagesJSON } from "../utils/lpmfiles.js";
import chalk from "chalk";
import { getcommand } from "../lpm.js";

export default class push {
  async Push(
    cwd: string | undefined,
    options: { Log?: boolean; scripts?: boolean; sync?: boolean },
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
    });
    if (OLD_PUBLISH_SIG === NEW_PUBLISH_SIG) {
      logreport("Nothing changed.", "log", true);
      process.exit();
    }
    logreport.logwithelapse(
      `${chalk.green(name)} is installed in ${chalk.green(
        pkg.installations.length
      )} directories....`,
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
          await this.Push(installation, options, true);
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

    logreport.logwithelapse(
      `${chalk.green(
        `[${Total_Updated}/${pkg.installations.length}]`
      )} packages successfully updated.`,
      "PUSH",
      true
    );
  }
  build(program: typeof CommanderProgram) {
    program
      .command("push [cwd]")
      .option("-log [boolean]", "Log command process.", false)
      .option("--no-scripts [boolean]", "Does not run any scripts")
      .description(
        "Publishes the package then updates all other packages that has it installed."
      )
      .action(async (cwd, options) => {
        await this.Push(cwd, options);
      });
  }
}
