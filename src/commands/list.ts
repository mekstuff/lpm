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
import pluralize from "pluralize";
interface ListOptions {
  all?: boolean;
  depth?: number;
}

export function ShowDiffChalk(str: unknown, comparison: unknown) {
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
    for (const VersionTreePackage in LPMPackagesJSON.version_tree) {
      if (targetPackage && targetPackage !== VersionTreePackage) {
        continue;
      }
      const t: Tree[] = [];
      for (const x of LPMPackagesJSON.version_tree[VersionTreePackage]) {
        const tp = LPMPackagesJSON.packages[`${VersionTreePackage}@${x}`];
        if (tp) {
          const j: Tree = { name: x + " | " + tp.publish_sig };
          const _t: Tree[] = [];
          for (const i of tp.installations) {
            const ijson = await ReadPackageJSON(i.path);
            const lockatdir = await ReadLockFileFromCwd(
              i.path,
              undefined,
              true
            );
            if (!lockatdir) {
              _t.push({
                name: "No LOCK file found => " + i.path,
              });
              j.children = _t;
              return;
            }
            const inlock = lockatdir.pkgs[`${VersionTreePackage}@${x}`];
            let p: string | undefined;
            if (ijson.success && typeof ijson.result !== "string") {
              p = `(${ijson.result.name}) | ${ShowDiffChalk(
                tp.publish_sig,
                tp.publish_sig === inlock.publish_sig
              )} | ${inlock.sem_ver_symbol + x}`;
            }
            const v: Tree[] = [];
            if (p) {
              v.push({
                name: chalk.underline(i.path),
              });
            }
            v.push({
              name: `${inlock.install_type} - ${pluralize(
                inlock.dependency_scope,
                1
              )} ${inlock.traverse_imports ? "| traverse-imports" : ""}`,
            });
            _t.push({
              name: p ? p : i.path,
              children: v,
            });
          }
          j.children = _t;
          t.push(j);
        }
      }
      tree.push({
        name: VersionTreePackage,
        children: t,
      });
    }
    console.log(LogTree.parse(tree, "f", "->"));
  }
  build(program: typeof CommanderProgram) {
    program
      .command("list [packageName]")
      .description("List lpm packages")
      .option("-a, --all", "List all published packages")
      .option("-d, --depth <number>", "Depth of the list tree", "1")
      .action(async (targetPackage, options) => {
        await this.List(targetPackage, options);
      });
  }
}
