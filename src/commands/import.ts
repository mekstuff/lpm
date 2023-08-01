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
      .description("imports published packages")
      .option("-pm, --package-manager [string]", "The package manager to use.")
      .action(async (packages, options) => {
        await this.import(packages, options);
      });
  }
}
