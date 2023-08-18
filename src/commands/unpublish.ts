import { Console } from "@mekstuff/logreport";
import { program as CommanderProgram } from "commander";
import pack from "./pack.js";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";
import {
  GetLPMPackagesDirectory,
  RemoveLPMPackageDirectory,
  RemovePackagesFromLPMJSON,
} from "../utils/lpmfiles.js";
import path from "path";

export default class unpublish extends pack {
  async Unpublish(packagePath: string | undefined) {
    packagePath = packagePath || ".";
    const { success, result } = await ReadPackageJSON(packagePath);
    if (!success) {
      Console.error(result);
    }
    if (!result || typeof result === "string") {
      return Console.error("Something went wrong while packing") as undefined;
    }
    if (!result.name) {
      return Console.error("Package must have a name to unpublish.");
    }
    if (!result.version) {
      return Console.error("Package must have a version to unpublish.");
    }
    const ParsedInfo = ParsePackageName(result.name, result.version);

    const UnpublishLog = Console.log(
      `Unpublishing ${ParsedInfo.FullResolvedName}`
    );
    UnpublishLog(`Unpublishing ${ParsedInfo.FullResolvedName}`);
    const PackageOutputPath = path.join(
      ParsedInfo.FullPackageName,
      ParsedInfo.PackageVersion
    );

    await RemovePackagesFromLPMJSON(
      [
        {
          name: ParsedInfo.FullPackageName,
          version: ParsedInfo.PackageVersion,
        },
      ],
      true
    ).then((removed) => {
      if (!removed) {
        Console.warn(
          `Could not remove package to global json file! ${ParsedInfo.FullResolvedName} => ${PackageOutputPath}`
        );
      }
    });
    try {
      const Removed = await RemoveLPMPackageDirectory(PackageOutputPath);
      if (!Removed) {
        Console.warn(
          `Failed to remove package file from global installation "${
            ParsedInfo.FullResolvedName
          }".\n\nYou can manually delete it from here\n${path.join(
            await GetLPMPackagesDirectory(),
            PackageOutputPath
          )}`
        );
      }
    } catch (err) {
      Console.error("Failed to unpublish " + err);
    }

    UnpublishLog("Package unpublished.");
  }

  /*
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
  */
  build(program: typeof CommanderProgram) {
    program
      .command("unpublish [packagePath]")
      .description("Unpublishes your package from the local registry.")
      .action(async (packagePath) => {
        this.Unpublish(packagePath);
      });
    /*
    program
      .command("unregister <packages...>")
      .description("Unpublishes the given packages by their names.")
      .action(async (packages) => {
        this.UnRegister(packages);
      });
      */
  }
  constructor() {
    super();
  }
}
