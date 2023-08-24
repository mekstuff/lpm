import semver from "semver";
import { program as CommanderProgram } from "commander";
import {
  GenerateLockAndAddFiles,
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
  dependency_scope,
} from "../utils/lpmfiles.js";
import { Console } from "@mekstuff/logreport";
import { ParsePackageName } from "../utils/PackageReader.js";
import chalk from "chalk";
import enqpkg from "enquirer";
import { BulkAddPackagesToLocalPackageJSON } from "./add.js";
const { prompt } = enqpkg;

interface upgradeoptions {
  latest?: boolean;
  currentDisabled?: boolean;
}
export default class updgrade {
  async Upgrade(Packages: string[], cwd: string, options: upgradeoptions) {
    const LOCK = await ReadLockFileFromCwd(cwd, undefined, true);
    if (!LOCK) {
      Console.error(`No lock file exists in "${cwd}"`);
      process.exit(1);
    }
    const LPMPackages = await ReadLPMPackagesJSON();
    const dataToUpgrade: { str: string; dependency_scope: dependency_scope }[] =
      [];
    for (const pkg in LOCK.pkgs) {
      const Parsed = ParsePackageName(pkg);
      const PackageInfo = LOCK.pkgs[pkg];
      console.log(Packages);
      if (
        Packages.length > 0 &&
        Packages.indexOf(Parsed.FullPackageName) === -1
      ) {
        continue;
      }
      const InVersionTree = LPMPackages.version_tree[Parsed.FullPackageName];
      if (!InVersionTree) {
        Console.error(
          `Could not find ${Parsed.FullPackageName} in version tree.`
        );
        process.exit(1);
      }
      InVersionTree.sort((a, b) => {
        return semver.compare(b, a);
      });
      let ver: string | undefined;
      if (!options.latest) {
        const x = await prompt<{ nv: string }>({
          name: "nv",
          type: "select",
          message: `${cwd} is currently using version ${Parsed.VersionWithSymbol} of ${Parsed.FullPackageName}`,
          choices: [
            ...InVersionTree.map((x) => {
              const PublishedData =
                LPMPackages.packages[Parsed.FullPackageName + "@" + x];
              // let str = PackageInfo.sem_ver_symbol + x;
              let str = PackageInfo.sem_ver_symbol + x;
              if (semver.lt(x, Parsed.PackageVersion)) {
                return { name: x, message: chalk.redBright(str) };
              }
              if (x === Parsed.PackageVersion) {
                return {
                  disabled: options.currentDisabled ? true : false,
                  name: x,
                  message: chalk.gray(
                    (str +=
                      " (current) " +
                      `(${
                        PublishedData.publish_sig === PackageInfo.publish_sig
                          ? PackageInfo.publish_sig
                          : chalk.redBright(PackageInfo.publish_sig)
                      } | ${PublishedData.publish_sig})`)
                  ),
                };
              }
              if (semver.satisfies(x, Parsed.VersionWithSymbol)) {
                return { name: x, message: chalk.greenBright(str) };
              }
              if (semver.gt(x, Parsed.PackageVersion)) {
                return { name: x, message: chalk.yellow(str) };
              }
              return { name: x, message: str };
            }),
            { name: "skip", message: "Exit" },
          ],
        });
        if (x.nv !== "skip") {
          ver = x.nv;
        } else {
          process.exit(1);
        }
      } else {
        ver = InVersionTree[0];
      }
      if (!ver) {
        Console.error(`Could not resolve version.`);
        process.exit(1);
      }
      let str = Parsed.FullPackageName + "@" + PackageInfo.sem_ver_symbol + ver;

      if (PackageInfo.traverse_imports) {
        str += " traverse-imports";
      }
      if (PackageInfo.install_type === "import") {
        str += " import";
      }
      dataToUpgrade.push({
        str: str,
        dependency_scope: PackageInfo.dependency_scope,
      });
    }
    const forBulk = async (
      dependency_scope: dependency_scope
    ): Promise<string[]> => {
      const t: string[] = [];
      dataToUpgrade.forEach((x, index) => {
        if (x.dependency_scope === dependency_scope) {
          dataToUpgrade.splice(index, 1);
          t.push(x.str);
        }
      });
      return t;
    };
    await BulkAddPackagesToLocalPackageJSON(cwd, [
      {
        Packages: await forBulk("dependencies"),
        dependency_scope: "dependencies",
      },
      {
        Packages: await forBulk("devDependencies"),
        dependency_scope: "devDependencies",
      },
      {
        Packages: await forBulk("peerDependencies"),
        dependency_scope: "peerDependencies",
      },
      {
        Packages: await forBulk("optionalDependencies"),
        dependency_scope: "optionalDependencies",
      },
    ]);
    await GenerateLockAndAddFiles(cwd, { lockVersion: true, showPmLogs: true });
  }
  build(program: typeof CommanderProgram) {
    program
      .command("upgrade [packages...]")
      .option(
        "--latest",
        "Upgrades to the latest compatiable version of a package without prompting a manual selection."
      )
      .action(async (packages, options) => {
        await this.Upgrade(packages, process.cwd(), options);
      });
  }
}
