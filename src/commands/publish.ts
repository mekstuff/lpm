import path from "path";
import tar from "tar";
import fs from "fs";
import { Console } from "@mekstuff/logreport";
import { program as CommanderProgram } from "commander";
import pack from "./pack.js";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";
import {
  AddPackagesToLPMJSON,
  CreateLPMPackageDirectory,
  GetLPMDirectory,
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
  force?: boolean;
  silent?: boolean;
}

export async function GetPublishTriggersDirectory() {
  return path.join(await GetLPMDirectory(), "publish_triggers");
}

async function TemporarilyAddPublishedFile(PackageName: string) {
  const TempAddPublishedFilesDir = path.join(
    await GetPublishTriggersDirectory(),
    PackageName
  );
  if (!fs.existsSync(TempAddPublishedFilesDir)) {
    fs.mkdirSync(TempAddPublishedFilesDir, { recursive: true });
    setTimeout(async () => {
      fs.rmSync(TempAddPublishedFilesDir, { recursive: true, force: true });
      const parsed = ParsePackageName(PackageName);
      if (parsed.OrginizationName !== "") {
        const p = path.join(
          await GetPublishTriggersDirectory(),
          parsed.OrginizationName
        );
        if (fs.existsSync(p)) {
          const st = fs.readdirSync(p);
          if (st.length === 0) {
            fs.rmSync(p, { force: true, recursive: true });
          }
        }
      }
    }, 400);
  }
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
      Console.error(result);
    }
    if (!result || typeof result === "string") {
      return Console.error(
        "Something went wrong while publishing"
      ) as undefined;
    }
    if (!result.name) {
      return Console.error("Package must have a name to publish.");
    }
    if (!result.version) {
      return Console.error("Package must have a version to publish.");
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
          Console.error(err);
          process.exit(1);
        });
    }
    const PublishLog = Console.log(`Publishing ${ParsedInfo.FullResolvedName}`);
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
      Console.error("Failed to pack. " + err);
    });

    if (!packRes) {
      Console.error("Failed to pack.");
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
        Console.warn(
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
      Console.error("Failed to publish " + err);
    }
    //since we already packed it, we still move it to `pkg` folder even if nothing has changed, however don't add to published directory so no autoupgrade detects it.
    if (OLDVERSION?.publish_sig === packRes.pack_signature && !Options.force) {
      Console.log("Nothing changed.");
      return;
    }
    if (!Options.silent) {
      TemporarilyAddPublishedFile(ParsedInfo.FullPackageName);
    }
    PublishLog(`Published`);
    return packRes.pack_signature;
  }
  build(program: typeof CommanderProgram) {
    program
      .command("publish [packagePath]")
      .description("Packages and publishes your package to the local registry.")
      .option("--no-scripts [boolean]", "Does not run any scripts")
      .option(
        "--silent",
        "Does not add to published directory, so will not trigger any `autoupgrade`"
      )
      .option(
        "--force [boolean]",
        "If nothing change, still run the publish request."
      )
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
