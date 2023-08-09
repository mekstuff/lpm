import path from "path";
import tar from "tar";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import pack from "./pack.js";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";
import {
  AddPackagesToLPMJSON,
  CreateLPMPackageDirectory,
  GetLPMPackagesDirectory,
  ReadLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import { BackUpLPMPackagesJSON } from "./backup.js";
import enqpkg from "enquirer";
import runScriptsSync from "../utils/run-scripts.js";
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
    packagePath = packagePath || process.cwd();
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
    if (!result.version) {
      return logreport.error("Package must have a version to publish.");
    }
    const ParsedInfo = ParsePackageName(result.name, result.version);
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const OLDVERSION = LPMPackagesJSON.packages[ParsedInfo.FullResolvedName];
    if (
      OLDVERSION &&
      OLDVERSION.requires_import === true &&
      Options.requiresImport !== true
    ) {
      await prompt<{ select: "yes" | "no" }>({
        name: "select",
        type: "select",
        message: `"${ParsedInfo.FullPackageName}" was previously published with requires-import, You are currently publishing without it set. Should we set the flag?`,
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
    logreport.Elapse(`Publishing ${ParsedInfo.FullResolvedName}`, "PUBLISH");
    runScriptsSync(packagePath, result, ["prepublishOnly"], Options.scripts);

    const PackageOutputPath = path.join(
      ParsedInfo.FullPackageName,
      ParsedInfo.PackageVersion
    );
    const packageinlpmdir = await CreateLPMPackageDirectory(PackageOutputPath);

    //package and ignore the .lpm directory for imports
    const packRes = await this.Pack(
      packagePath,
      {
        out: path.join(
          await GetLPMPackagesDirectory(),
          PackageOutputPath,
          "tarbal.tgz"
        ),
        scripts: Options.scripts,
      },
      [".lpm"]
    ).catch((err) => {
      console.error(err);
      logreport.error("Failed to pack. " + err);
    });

    if (!packRes) {
      logreport.error("Failed to pack.");
      process.exit(1);
    }

    await AddPackagesToLPMJSON([
      {
        name: ParsedInfo.FullPackageName,
        version: result.version,
        resolve: path.join(packageinlpmdir, "pkg"),
        publish_signature: packRes.pack_signature,
        requires_import: Options.requiresImport ? true : undefined,
        publish_directory: packagePath,
      },
    ]).then((added) => {
      if (!added) {
        logreport(
          `Could not add package to global json file! ${ParsedInfo.FullResolvedName} => ${packageinlpmdir}`
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
