import semver from "semver";
import { Console } from "@mekstuff/logreport";
import { program as CommanderProgram } from "commander";
import {
  ILPMPackagesJSON,
  LOCKFILEPKG,
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
  ResolvePackageFromLPMJSON,
} from "../utils/lpmfiles.js";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";

import enqpkg from "enquirer";
import chalk from "chalk";
import { getcommand } from "../lpm.js";
import { ShowDiffChalk } from "./list.js";
const { prompt } = enqpkg;

interface upgradeoptions {
  latest?: boolean;
  currentDisabled?: boolean;
}
export default class upgrade {
  async RunUpgrade(
    Name: string,
    PackageInfo: LOCKFILEPKG,
    LPMPackages: ILPMPackagesJSON,
    dirname: string,
    options: upgradeoptions,
    returnRequests?: string[]
  ) {
    const Parsed = ParsePackageName(
      Name,
      undefined,
      PackageInfo.sem_ver_symbol
    );
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
    if (options.latest) {
      const Latest = semver.maxSatisfying(
        InVersionTree,
        Parsed.VersionWithSymbol
      );
      const LatestPublishedVersion = await ResolvePackageFromLPMJSON(
        `${Parsed.FullPackageName}@${Latest}`
      );
      Console.info(
        `${ShowDiffChalk(
          Parsed.FullResolvedName,
          Parsed.PackageVersion === Latest
        )} | ${ShowDiffChalk(
          PackageInfo.publish_sig,
          PackageInfo.publish_sig ===
            LatestPublishedVersion?.Package.publish_sig
        )} => ${chalk.greenBright(
          `${LatestPublishedVersion?.Parsed.FullResolvedName} | ${LatestPublishedVersion?.Package.publish_sig}`
        )}`
      );
      return;
    }
    await prompt<{ nv: string }>({
      name: "nv",
      type: "select",
      message: `${dirname} is currently using version ${Parsed.VersionWithSymbol} of ${Parsed.FullPackageName}`,
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
    })
      .then(async (res) => {
        if (res.nv === "skip") {
          process.exit();
        }
        const str = `${Parsed.FullPackageName}@${Parsed.SemVersionSymbol}${res.nv}`;
        if (returnRequests) {
          returnRequests.push(str);
          return;
        }
        await getcommand("add").Add([str], {
          showPmLogs: true,
          lockVersion: true,
        });
      })
      .catch((err) => {
        Console.error(err);
      });
  }
  async Upgrade(
    targetPackages: string[] | undefined,
    cwd: string,
    options: upgradeoptions
  ) {
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
      Console.log(`(${chalk.underline(cwd)})`);
      await this.RunUpgrade(
        pkgName,
        pkg,
        LPMPackages,
        dirname,
        options,
        toRunUpdate
      );
      TotalUpgradesRequestRan++;
    }
    if (TotalUpgradesRequestRan > 0) {
      await getcommand("add").Add(
        toRunUpdate,
        {
          showPmLogs: true,
          lockVersion: true,
        },
        cwd
      );
    } else {
      Console.log("Nothing to upgrade.");
    }
  }
  build(program: typeof CommanderProgram) {
    program
      .command("upgrade [packages...]")
      .option(
        "--latest",
        "upgrades to the latest compatiable version of package without prompting selection."
      )
      .action(async (packages, options) => {
        await this.Upgrade(packages, process.cwd(), options);
      });
  }
}
