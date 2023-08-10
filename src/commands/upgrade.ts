import LogReport from "@mekstuff/logreport";
import semver from "semver";
import { program as CommanderProgram } from "commander";
import {
  ILPMPackagesJSON,
  LOCKFILEPKG,
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
} from "../utils/lpmfiles.js";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";

import enqpkg from "enquirer";
import chalk from "chalk";
import { getcommand } from "../lpm.js";
const { prompt } = enqpkg;

export default class upgrade {
  async RunUpgrade(
    Name: string,
    PackageInfo: LOCKFILEPKG,
    LPMPackages: ILPMPackagesJSON,
    dirname: string,
    returnRequests?: string[]
  ) {
    const Parsed = ParsePackageName(
      Name,
      undefined,
      PackageInfo.sem_ver_symbol
    );
    const InVersionTree = LPMPackages.version_tree[Parsed.FullPackageName];
    if (!InVersionTree) {
      LogReport.error(
        `Could not find ${Parsed.FullPackageName} in version tree.`
      );
      process.exit(1);
    }
    InVersionTree.sort((a, b) => {
      return semver.compare(b, a);
    });

    await prompt<{ nv: string }>({
      name: "nv",
      type: "select",
      message: `${dirname} is currently using version ${Parsed.VersionWithSymbol} of ${Parsed.FullPackageName}`,
      choices: [
        ...InVersionTree.map((x) => {
          const PublishedData =
            LPMPackages.packages[Parsed.FullPackageName + "@" + x];
          let str = PackageInfo.sem_ver_symbol + x;
          if (semver.lt(x, Parsed.PackageVersion)) {
            return { name: x, message: chalk.redBright(str) };
          }
          if (x === Parsed.PackageVersion) {
            return {
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
            //   return
            return { name: x, message: chalk.yellow(str) };
          }
          return { name: x, message: str };
        }),
        { name: "skip", message: "Exit" },
      ],
    })
      .then(async (res) => {
        if (res.nv === "skip") {
          return;
        }
        const str = `${Parsed.FullPackageName}@${Parsed.SemVersionSymbol}${res.nv}`;
        if (returnRequests) {
          returnRequests.push(str);
          return;
        }
        await getcommand("add").Add([str], {
          showPmLogs: true,
        });
      })
      .catch((err) => {
        LogReport.error(err);
      });
  }
  async Upgrade(targetPackages: string[] | undefined, cwd: string) {
    const currjson = await ReadPackageJSON(cwd);
    let dirname = cwd;
    if (
      currjson.success &&
      typeof currjson.result !== "string" &&
      currjson.result.name
    ) {
      dirname = currjson.result.name;
    }
    const LOCK = await ReadLockFileFromCwd(cwd);
    const LPMPackages = await ReadLPMPackagesJSON();
    let TotalUpgradesRequestRan = 0;
    const toRunUpdate: string[] = [];
    for (const pkgName in LOCK.pkgs) {
      if (targetPackages && targetPackages.length > 0) {
        if (
          targetPackages.indexOf(ParsePackageName(pkgName).FullPackageName) ==
          -1
        ) {
          continue;
        }
      }
      const pkg = LOCK.pkgs[pkgName];
      LogReport(`(${chalk.underline(cwd)})`, "log", true);
      await this.RunUpgrade(pkgName, pkg, LPMPackages, dirname, toRunUpdate);

      TotalUpgradesRequestRan++;
    }
    if (TotalUpgradesRequestRan > 0) {
      await getcommand("add").Add(
        toRunUpdate,
        {
          showPmLogs: true,
        },
        cwd
      );
    } else {
      LogReport("Nothing to upgrade.", "log", true);
    }
  }
  build(program: typeof CommanderProgram) {
    program.command("upgrade [packages...]").action(async (packages) => {
      await this.Upgrade(packages, process.cwd());
    });
  }
}
