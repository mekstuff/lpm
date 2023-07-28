import fs from "fs";
import path from "path";
import chalk from "chalk";
import { program as CommanderProgram } from "commander";
import { ReadLPMPackagesJSON, ReadLockFileFromCwd } from "../utils/lpmfiles.js";
import LogTree, { Tree } from "console-log-tree";
import { ReadPackageJSON } from "../utils/PackageReader.js";

interface ListOptions {
  all?: boolean;
  depth?: number;
}

export default class list {
  async List(targetPackage: string | undefined, Options: ListOptions) {
    Options.depth = Number(Options.depth);
    // Options.depth = (Options.depth === undefined && 1) || Options.depth;
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
        subTreeChildren.push({
          name:
            Package + chalk.yellow(` | ${LockFile.pkgs[Package].publish_sig}`),
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
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const tree: Tree[] = [];

    for (const Package in LPMPackagesJSON.packages) {
      if (targetPackage && targetPackage !== Package) {
        continue;
      }
      const children: Tree[] = [];
      if (Options.depth !== 0) {
        LPMPackagesJSON.packages[Package].installations.forEach(
          (installation) => {
            let name: string;
            try {
              name = JSON.parse(
                fs
                  .readFileSync(path.join(installation, "package.json"))
                  .toString()
              ).name;
            } catch (e) {
              name = installation + " | " + chalk.red("No package.json");
            }
            if (
              fs.existsSync(path.join(process.cwd(), "node_modules", Package))
            ) {
              name += " | " + chalk.yellow("Not installed.");
            }
            children.push({
              name: name,
            });
          }
        );
      }

      tree.push({
        name:
          Package +
          chalk.yellow(` | ${LPMPackagesJSON.packages[Package].publish_sig}`),
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
      .option("-d, --depth <number>", "List all published packages", "0")
      .action(async (targetPackage, options) => {
        await this.List(targetPackage, { ...options, all: true });
      });
  }
}
