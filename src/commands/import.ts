import pluralize from "pluralize";
import { Console } from "@mekstuff/logreport";
import { program as CommanderProgram } from "commander";
import { getcommand } from "../lpm.js";
import { AddOptions } from "./add.js";

export default class IMPORT {
  async import(
    Packages: string[],
    Options: AddOptions
    /*{
      showPmLogs?: boolean;
      packageManager?: SUPPORTED_PACKAGE_MANAGERS;
      dev?: boolean;
      peer?: boolean;
      optional?: boolean;
      lock
    }*/
  ) {
    Console.log(
      `Importing ${Packages.length} ${pluralize("package", Packages.length)}`
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
        "--lock-version [boolean]",
        "If package@^1.4.5 is to be installed and package@1.4.6 exists, 1.4.6 will be selected by default. No version bump will force current installation to use @1.4.5. Done by tricking the LOCK file and have to package installed as @!1.4.5, but package.json will still be @^1.4.5, any other installations will resolve to @^1.4.5"
      )
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
