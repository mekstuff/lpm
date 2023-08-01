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
  ReadLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import { execSync } from "child_process";
import { BackUpLPMPackagesJSON } from "./backup.js";
import enqpkg from "enquirer";
const { prompt } = enqpkg;

interface PublishOptions {
  scripts?: boolean;
  requiresImport?: boolean;
  // push?: boolean;
}

export default class publish extends pack {
  async Publish(
    packagePath: string | undefined,
    Options: PublishOptions
  ): Promise<string | void> {
    await BackUpLPMPackagesJSON();
    packagePath = packagePath || ".";
    const { success, result } = await ReadPackageJSON(packagePath);
    if (!success) {
      logreport.error(result);
    }
    if (!result || typeof result === "string") {
      return logreport.error(
        "Something went wrong while publishing"
      ) as undefined;
    }
    if (!result.name) {
      return logreport.error("Package must have a name to publish.");
    }
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const OLDVERSION = LPMPackagesJSON.packages[result.name];
    if (
      OLDVERSION &&
      OLDVERSION.requires_import === true &&
      Options.requiresImport !== true
    ) {
      await prompt<{ select: "yes" | "no" }>({
        name: "select",
        type: "select",
        message: `"${result.name}" was previously published with requires-import, You are currently publishing without it set. Should we set the flag?`,
        choices: ["yes", "no"],
      })
        .then((res) => {
          if (res.select === "yes") {
            Options.requiresImport = true;
          }
        })
        .catch((err) => {
          logreport.error(err);
          process.exit(1);
        });
    }
    logreport.Elapse(
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
        // logreport.warn(
        //   "scripts detected but `--no-scripts` flag was passed, not executing."
        // );
      }
    }
    const packageinlpmdir = await CreateLPMPackageDirectory(result.name);

    const packRes = await this.Pack(packagePath, {
      out: path.join(
        await GetLPMPackagesDirectory(),
        result.name,
        "tarbal.tgz"
      ),
      scripts: Options.scripts,
    }).catch((err) => {
      console.error(err);
      logreport.error("Failed to pack. " + err);
    });

    if (!packRes) {
      logreport.error("Failed to pack.");
      process.exit(1);
    }

    await AddPackagesToLPMJSON([
      {
        name: result.name,
        resolve: path.join(packageinlpmdir, "pkg"),
        publish_signature: packRes.pack_signature,
        requires_import: Options.requiresImport ? true : undefined,
      },
    ]).then((added) => {
      if (!added) {
        logreport(
          `Could not add package to global json file! ${result.name} => ${packageinlpmdir}`
        );
      }
    });

    try {
      tar.x({
        file: packRes.outpath as string,
        cwd: path.join(packageinlpmdir, "pkg"),
        sync: true,
      });
    } catch (err) {
      console.log(err);
      logreport.error("Failed to publish " + err);
    }

    logreport.EndElapse("PUBLISH");

    return packRes.pack_signature;

    /*
    if (Options.push) {
      await getcommand("push").Push(packagePath, {});
    }
    */
  }
  build(program: typeof CommanderProgram) {
    program
      .command("publish [packagePath]")
      .description("Packages and publishes your package to the local registry.")
      .option("--no-scripts [boolean]", "Does not run any scripts")
      .option(
        "--requires-import [boolean]",
        "For the package to be installed it must be used as an imported package."
      )
      .action(async (packagePath, Options) => {
        this.Publish(packagePath, Options);
      });
  }
  constructor() {
    super();
  }
}
