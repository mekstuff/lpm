import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import pack from "./pack.js";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import {
  CreateLPMPackageDirectory,
  GetLPMPackagesDirectory,
  ReadLPMPackagesJSON,
  RemoveLPMPackageDirectory,
  RemovePackagesFromLPMJSON,
} from "../utils/lpmfiles.js";

export default class unpublish extends pack {
  async Unpublish(packagePath: string | undefined) {
    packagePath = packagePath || ".";
    const { success, result } = await ReadPackageJSON(packagePath);
    if (!success) {
      logreport.error(result);
    }
    if (!result || typeof result === "string") {
      return logreport.error("Something went wrong while packing") as undefined;
    }
    if (!result.name) {
      return logreport.error("Package must have a name to unpublish.");
    }
    logreport.Elapse(
      `Unpublishing ${result?.name} ${result?.version}`,
      "UNPUBLISH"
    );
    const packageinlpmdir = await CreateLPMPackageDirectory(result.name); //remove...
    await RemovePackagesFromLPMJSON([result.name]).then((removed) => {
      if (!removed) {
        logreport(
          `Could not remove package to global json file! ${result.name} => ${packageinlpmdir}`
        );
      }
    });
    try {
      const Removed = await RemoveLPMPackageDirectory(result.name);
      if (!Removed) {
        logreport(
          `Failed to remove package file from global installation "${
            result.name
          }".\n\n You can manually delete it from here\n${await GetLPMPackagesDirectory()}`
        );
      }
    } catch (err) {
      logreport.error("Failed to publish " + err);
    }

    logreport.EndElapse("UNPUBLISH");
  }

  async UnRegister(packages: string[]) {
    logreport.Elapse("Unregistering packages...", "UNREGISTER");
    const RegisteredPackages = await ReadLPMPackagesJSON();
    packages.forEach(async (Package) => {
      if (!RegisteredPackages.packages[Package]) {
        logreport.error(
          Package + " was not discovered as a published package."
        );
      }
    });
    //remove from JSON
    logreport.Elapse("Removing from global packages...", "UNREGISTER");
    await RemovePackagesFromLPMJSON(packages);
    //remove tarbals
    logreport.Elapse("Removing files...", "UNREGISTER");
    packages.forEach(async (pkg) => {
      await RemoveLPMPackageDirectory(pkg);
    });
    logreport.Elapse("Unregistered packages", "UNREGISTER", true);
  }
  build(program: typeof CommanderProgram) {
    program
      .command("unpublish [packagePath]")
      .description("Unpublishes your package from the local registry.")
      .action(async (packagePath) => {
        this.Unpublish(packagePath);
      });
    program
      .command("unregister <packages...>")
      .description("Unpublishes the given packages by their names.")
      .action(async (packages) => {
        this.UnRegister(packages);
      });
  }
  constructor() {
    super();
  }
}
