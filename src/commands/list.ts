import fs from "fs";
import path from "path";
import chalk from "chalk";
import { program as CommanderProgram } from "commander";
import {
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
  ResolvePackageFromLPMJSON,
} from "../utils/lpmfiles.js";
import LogTree, { Tree } from "console-log-tree";
import {
  GetHighestVersion,
  ParsePackageName,
  ReadPackageJSON,
} from "../utils/PackageReader.js";

interface ListOptions {
  all?: boolean;
  depth?: number;
}

function ShowDiffChalk(str: unknown, comparison: unknown) {
  if (comparison) {
    return chalk.green(str);
  }
  return chalk.yellow(str);
}

export default class list {
  async List(targetPackage: string | undefined, Options: ListOptions) {
    Options.depth = Number(Options.depth);
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    if (!Options.all) {
      const PackageJSON = await ReadPackageJSON(process.cwd());
      if (
        PackageJSON.success === false ||
        typeof PackageJSON.result === "string"
      ) {
        return;
      }
      const LockFile = await ReadLockFileFromCwd();
      const tree: Tree[] = [];
      const subTreeChildren: Tree[] = [];

      for (const Package in LockFile.pkgs) {
        if (targetPackage && targetPackage !== Package) {
          continue;
        }
        const pkg = LockFile.pkgs[Package];
        const pkgNameParsed = ParsePackageName(
          Package,
          undefined,
          pkg.sem_ver_symbol
        );
        const PublishedInfo = await ResolvePackageFromLPMJSON(
          Package,
          LPMPackagesJSON
        );
        let SHOW_NAME = pkgNameParsed.FullSemVerResolvedName;
        if (PublishedInfo) {
          const OtherVersions =
            LPMPackagesJSON.version_tree[PublishedInfo.Parsed.FullPackageName];
          if (OtherVersions) {
            const HighestFeatVersion = await GetHighestVersion(
              OtherVersions,
              pkgNameParsed.VersionWithSymbol
            );
            const HighestBreakingVersion = await GetHighestVersion(
              OtherVersions
            );
            const HighestFeaturedVersionStr = ShowDiffChalk(
              HighestFeatVersion,
              HighestFeatVersion === pkgNameParsed.PackageVersion
            );
            const HighestBreakingVersionStr = ShowDiffChalk(
              HighestBreakingVersion,
              HighestBreakingVersion === PublishedInfo.Parsed.PackageVersion
            );
            SHOW_NAME += ` | ${HighestFeaturedVersionStr} | ${HighestBreakingVersionStr}`;
          }
          SHOW_NAME += ` | ${ShowDiffChalk(
            pkg.publish_sig,
            PublishedInfo.Package.publish_sig === pkg.publish_sig
          )}`;
        } else {
          SHOW_NAME += ` | ${chalk.red("NOT PUBLISHED!")}`;
        }
        subTreeChildren.push({
          name: SHOW_NAME,
        });
      }
      tree.push({
        name: PackageJSON.result?.name as string,
        children: subTreeChildren,
      });
      console.log(LogTree.parse(tree));
      return;
    }

    //--all
    const tree: Tree[] = [];

    for (const Package in LPMPackagesJSON.packages) {
      if (targetPackage && targetPackage !== Package) {
        continue;
      }
      const children: Tree[] = [];
      if (Options.depth !== 0) {
        for (const installation of LPMPackagesJSON.packages[Package]
          .installations) {
          let name: string;
          let installed_signature: string | undefined;
          try {
            name = JSON.parse(
              fs
                .readFileSync(path.join(installation.path, "package.json"))
                .toString()
            ).name;
          } catch (e) {
            name = installation + " | " + chalk.red("No package.json");
          }
          try {
            const LOCK = await ReadLockFileFromCwd(
              installation.path,
              undefined,
              true
            );
            if (LOCK) {
              const t = LOCK.pkgs[Package] && LOCK.pkgs[Package].publish_sig;
              if (t) {
                installed_signature = t;
              } else {
                installed_signature = "no-install-signature";
              }
            }
          } catch (e) {
            installed_signature = "failed-to-read-publish-signature";
          }
          const p = path.join(installation.path, "node_modules", Package);
          if (!fs.existsSync(p)) {
            name += " | " + chalk.yellow("Not in node_modules");
          }
          const SHOW_SIGNATURE =
            installed_signature ===
            LPMPackagesJSON.packages[Package].publish_sig
              ? chalk.green(installed_signature)
              : chalk.yellow(installed_signature);
          name += " | " + SHOW_SIGNATURE;
          children.push({
            name: name,
          });
        }
      }

      tree.push({
        name:
          "\n" +
          Package +
          chalk.bold(` | ${LPMPackagesJSON.packages[Package].publish_sig}`),
        children: children,
      });
    }
    console.log(LogTree.parse(tree));
  }
  build(program: typeof CommanderProgram) {
    program
      .command("list [packageName]")
      .description("List lpm packages")
      .option("-a, --all", "List all published packages")
      .option("-d, --depth <number>", "List all published packages", "0")
      .action(async (targetPackage, options) => {
        await this.List(targetPackage, options);
      })
      .command("all [packageName]")
      .option("-d, --depth <number>", "List all published packages", "1")
      .action(async (targetPackage, options) => {
        //TODO: Fix: depth is always 1 no matter if it was set in terminal.
        await this.List(targetPackage, { ...options, all: true });
      });
  }
}
