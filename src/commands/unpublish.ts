import path from "path";
import fs from "fs";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import pack from "./pack.js";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import {
  CreateLPMPackageDirectory,
  GetLPMPackagesDirectory,
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
    logreport.logwithelapse(
      `Unpublishing ${result?.name} ${result?.version}`,
      "UNPUBLISH"
    );
    const packageinlpmdir = await CreateLPMPackageDirectory(result.name);
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

    logreport.endelapse("UNPUBLISH");
  }
  build(program: typeof CommanderProgram) {
    program
      .command("unpublish [packagePath]")
      .description("Unpublishes your package to the local registry.")
      .action(async (packagePath) => {
        this.Unpublish(packagePath);
      });
  }
  constructor() {
    super();
  }
}
