import chalk from "chalk";
import logreport from "../utils/logreport.js";
import pluralize from "pluralize";
import { program as CommanderProgram } from "commander";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";
import {
  ILPMPackagesJSON_Package_installation,
  ReadLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import { getcommand } from "../lpm.js";

export default class push {
  async Push(
    cwd: string | undefined,
    options: {
      Log?: boolean;
      scripts?: boolean;
      force?: boolean;
      requiresImport?: boolean;
      bump?: boolean;
    },
    CaptureNotPublished?: boolean
  ) {
    if (typeof cwd !== "string") {
      cwd = process.cwd();
    }
    const PackageJSON = await ReadPackageJSON(cwd);
    if (!PackageJSON.success || typeof PackageJSON.result === "string") {
      logreport.error("Could not read package. => " + PackageJSON.result);
      process.exit(1);
    }
    const name = PackageJSON.result.name;
    if (!name) {
      logreport.error("Package does not have a name.");
      process.exit(1);
    }

    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const ParsedName = ParsePackageName(name, PackageJSON.result.version);
    const pkg = LPMPackagesJSON.packages[ParsedName.FullResolvedName];

    if (!pkg) {
      if (CaptureNotPublished) {
        return;
      }
      logreport.error(`${name} is not published.`);
      process.exit(1);
    }

    const OLD_PUBLISH_SIG = pkg.publish_sig;
    const NEW_PUBLISH_SIG = await getcommand("publish").Publish(cwd, {
      scripts: options.scripts,
      requiresImport: options.requiresImport,
      log: options.Log,
    });
    if (OLD_PUBLISH_SIG === NEW_PUBLISH_SIG && !options.force) {
      logreport("Nothing changed." + cwd, "log", true);
      process.exit();
    }

    let Total_Updated = 0;
    let TargetInstallationsList: ILPMPackagesJSON_Package_installation[] = [];
    if (options.bump) {
      const PublishedVersions =
        LPMPackagesJSON.version_tree[ParsedName.FullPackageName];
      if (!PublishedVersions) {
        logreport.error(
          `Could not resolved published version of ${ParsedName.FullPackageName} in version tree.`
        );
        process.exit(1);
      }
      for (const v of PublishedVersions) {
        const tn = `${ParsedName.PackageName}@${v}`;
        const t = LPMPackagesJSON.packages[tn];
        if (!t) {
          logreport.warn(
            `${tn} does not exist in packages but was found in version tree, Skipping`
          );
          continue;
        }
        TargetInstallationsList = [
          ...TargetInstallationsList,
          ...t.installations,
        ];
      }
    } else {
      TargetInstallationsList = pkg.installations;
    }
    logreport.Elapse(
      `${chalk.green(name)} is installed in ${chalk.green(
        TargetInstallationsList.length
      )} ${pluralize("directory", TargetInstallationsList.length)}...`,
      "PUSH"
    );
    const OG_dir = process.cwd();
    for (const installation of TargetInstallationsList) {
      process.chdir(installation.path);
      logreport(`Pushing to: ${installation.path}`, "info", true);
      try {
        await getcommand("add").Add([`${ParsedName.FullPackageName}`], {
          preserveImport: true,
        });
        await this.Push(installation.path, options, true);
        Total_Updated++;
      } catch (e) {
        logreport.warn(`Failed to push on dir "${installation.path}". ${e}`);
      }
    }
    process.chdir(OG_dir);
    logreport.Elapse(
      `${chalk.green(
        `[${Total_Updated}/${TargetInstallationsList.length}]`
      )} ${pluralize(
        "package",
        Total_Updated
      )} successfully updated. ${OG_dir}`,
      "PUSH",
      true
    );
  }
  build(program: typeof CommanderProgram) {
    program
      .command("push [cwd]")
      .option("-log [boolean]", "Log command process.", false)
      .option(
        "-b, --bump",
        "Bumping will go through all installed version of the package, not just the currently published version. This does not mean all versions will update to this specific version, but instead update to their latest compatiable version. e.g ^1.2.4 => 1.3.0"
      )
      .option("--no-scripts [boolean]", "Does not run any scripts")
      .option(
        "-f, --force [boolean]",
        "Forces the publish even if nothing was changed."
      )
      .option(
        "--requires-import [boolean]",
        "For the package to be installed it must be used as an imported package."
      )
      .description(
        "Publishes the package then updates all other packages that has the version installed. Use --bump to ignore the version and run on every installations."
      )
      .action(async (cwd, options) => {
        await this.Push(cwd, options);
      });
  }
}
