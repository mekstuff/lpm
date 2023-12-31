import path from "path";
import tar from "tar";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import pack from "./pack.js";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import {
  AddPackagesToLPMJSON,
  CreateLPMPackageDirectory,
  GetLPMPackagesDirectory,
} from "../utils/lpmfiles.js";
import { execSync } from "child_process";
import { BackUpLPMPackagesJSON } from "./backup.js";

interface PublishOptions {
  scripts?: boolean;
}

export default class publish extends pack {
  async Publish(packagePath: string | undefined, Options: PublishOptions) {
    await BackUpLPMPackagesJSON();
    packagePath = packagePath || ".";
    const { success, result } = await ReadPackageJSON(packagePath);
    if (!success) {
      logreport.error(result);
    }
    if (!result || typeof result === "string") {
      return logreport.error("Something went wrong while packing") as undefined;
    }
    if (!result.name) {
      return logreport.error("Package must have a name to publish.");
    }
    logreport.logwithelapse(
      `Publishing ${result?.name} ${result?.version}`,
      "PUBLISH"
    );
    if (result.scripts) {
      if (Options.scripts) {
        const PrePublishOnlyScript = result.scripts["prepublishOnly"];
        if (PrePublishOnlyScript) {
          logreport("Running `prepublishOnly` script", "log", true);
          execSync(PrePublishOnlyScript, {
            cwd: packagePath,
            stdio: "inherit",
          });
        }
      } else {
        logreport.warn(
          "scripts detected but `--no-scripts` flag was passed, not executing."
        );
      }
    }
    const packageinlpmdir = await CreateLPMPackageDirectory(result.name);
    await AddPackagesToLPMJSON([
      { name: result.name, resolve: path.join(packageinlpmdir, "pkg") },
    ]).then((added) => {
      if (!added) {
        logreport(
          `Could not add package to global json file! ${result.name} => ${packageinlpmdir}`
        );
      }
    });
    const tarbaldir = await this.Pack(packagePath, {
      out: path.join(
        await GetLPMPackagesDirectory(),
        result.name,
        "tarbal.tgz"
      ),
    }).catch((err) => {
      console.error(err);
      logreport.error("Failed to pack. " + err);
    });
    try {
      tar.x({
        file: tarbaldir as string,
        cwd: path.join(packageinlpmdir, "pkg"),
        sync: true,
      });
    } catch (err) {
      logreport.error("Failed to publish " + err);
    }

    logreport.endelapse("PUBLISH");
  }
  build(program: typeof CommanderProgram) {
    program
      .command("publish [packagePath]")
      .description("Packages and publishes your package to the local registry.")
      .option("--no-scripts [boolean]", "Does not run any scripts")
      .action(async (packagePath, Options) => {
        this.Publish(packagePath, Options);
      });
  }
  constructor() {
    super();
  }
}
