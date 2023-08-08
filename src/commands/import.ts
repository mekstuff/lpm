import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import pluralize from "pluralize";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { getcommand } from "../lpm.js";

export default class IMPORT {
  async import(
    Packages: string[],
    Options: {
      showPmLogs?: boolean;
      packageManager?: SUPPORTED_PACKAGE_MANAGERS;
      dev?: boolean;
      peer?: boolean;
      optional?: boolean;
    }
  ) {
    logreport.Elapse(
      `Importing ${Packages.length} ${pluralize("package", Packages.length)}`,
      "IMPORT"
    );
    await getcommand("add").Add(Packages, { import: true, ...Options });
  }

  build(program: typeof CommanderProgram) {
    program
      .command("import <packages...>")
      .option(
        "-log, --show-pm-logs [boolean]",
        "Show package managers output in terminal.",
        false
      )
      .description("imports published packages.")
      .option("-D, --dev", "Import as dev dependency")
      .option("-P, --peer", "Import as dev dependency")
      .option("-O, --optional", "Import as optional dependency")
      .option(
        "--traverse-imports",
        "Makes it so every imported package dependency is imported aswell. e.g `pkg1` has dependency of `pkg2`, `pkg1` does not import `pkg2`, when `pkg3` installs `pkg1` to have pkg2 to be imported aswell, use this flag. "
      )
      .option("-pm, --package-manager [string]", "The package manager to use.")
      .action(async (packages, options) => {
        await this.import(packages, options);
      });
  }
}
