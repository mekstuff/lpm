import chalk from "chalk";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { GetPreferredPackageManager } from "./add.js";
import { Console } from "@mekstuff/logreport";
import { exec } from "child_process";
import { BulkRemovePackagesFromLocalCwdStore } from "./add.js";
import {
  ParsePackageName,
  ReadPackageJSON,
  WritePackageJSON,
} from "../utils/PackageReader.js";
import {
  GenerateLockFileAtCwd,
  ReadLockFileFromCwd,
} from "../utils/lpmfiles.js";

interface RemoveOptions {
  packageManager?: SUPPORTED_PACKAGE_MANAGERS;
  skipLockCheck?: boolean;
  skipRegistryCheck?: boolean;
  showPmLogs?: boolean;
}

export default class remove {
  async Remove(Arg0: string[], Options: RemoveOptions) {
    const LOCKFILE = await ReadLockFileFromCwd();
    if (!Options.packageManager) {
      Options.packageManager = await GetPreferredPackageManager(process.cwd());
    }
    Console.assert(
      SUPPORTED_PACKAGE_MANAGERS.indexOf(Options.packageManager) !== -1,
      `Unsupported package manager "${Options.packageManager}"`
    );
    const Packages: string[] = [];
    const PackageManagerFlags: string[] = [];
    const PackageJSON = await ReadPackageJSON(process.cwd());
    if (!PackageJSON.success || typeof PackageJSON.result === "string") {
      Console.error(`No package.json found.`);
      process.exit(1);
    }
    //seperate the uninstall string packages since we can't include a @version when uninstall.
    const UNINSTALL_PKGS_STRBUILD: string[] = [];
    Arg0.forEach((arg) => {
      if (!arg.match("^-")) {
        Packages.push(arg);
      } else {
        PackageManagerFlags.push(arg);
      }
    });
    const RemoveLog = Console.log(
      `Removing ${Packages.length} package${Packages.length === 1 ? "" : "s"}.`
    );
    for (const index in Packages) {
      const pkg = Packages[index];
      let ParsedInfo = ParsePackageName(pkg);
      //if a specific version is listed, then we need to get the currently installed version.
      if (ParsedInfo.PackageVersion === "latest") {
        for (const f in LOCKFILE.pkgs) {
          const parsed = ParsePackageName(f);
          if (parsed.FullPackageName === ParsedInfo.FullPackageName) {
            ParsedInfo = parsed;
          }
        }
      }
      RemoveLog(
        `Fetching package ${chalk.blue(ParsedInfo.FullResolvedName)} [${
          Number(index) + 1
        } / ${Packages.length}]...`
      );
      if (!Options.skipLockCheck) {
        if (!LOCKFILE.pkgs[ParsedInfo.FullResolvedName]) {
          Console.error(
            pkg +
              " was not found in lock file. use `--skip-lock-check` to ignore this check."
          );
        }
      }
      Packages[index] = ParsedInfo.FullResolvedName;
      if (
        PackageJSON.result["local"] &&
        PackageJSON.result["local"][
          LOCKFILE.pkgs[ParsedInfo.FullResolvedName].dependency_scope
        ]
      ) {
        PackageJSON.result["local"][
          LOCKFILE.pkgs[ParsedInfo.FullResolvedName].dependency_scope
        ] = undefined;
      }
      //Set to package name since we don't need version
      UNINSTALL_PKGS_STRBUILD.push(ParsedInfo.FullPackageName);
    }
    RemoveLog(
      `Removing from package manager ${chalk.blue(Options.packageManager)}...`
    );

    const execString =
      Options.packageManager +
      " remove " +
      UNINSTALL_PKGS_STRBUILD.join(" ") +
      PackageManagerFlags.join(" ");

    Console.VERBOSE(`Executing "${execString}"`);
    const p = new Promise<number | null>((resolve) => {
      const executed = exec(execString);
      executed.on("exit", (code) => {
        resolve(code);
      });
      if (Options.showPmLogs) {
        console.log("\n");
      }
      executed.stdout?.on("data", (data) => {
        if (Options.showPmLogs) {
          Console.LOG(
            data.toString(),
            "log",
            chalk.blue(Options.packageManager?.toUpperCase() + " INFO ")
          );
        }
      });
      executed.stderr?.on("data", (data) => {
        if (Options.showPmLogs) {
          Console.LOG(
            data.toString(),
            "log",
            chalk.blue(Options.packageManager?.toUpperCase() + " INFO ")
          );
        }
      });
    });
    Console.VERBOSE(`Exit Code "${await p}"`);
    const np = await ReadPackageJSON(process.cwd());
    if (!np.success || typeof np.result === "string") {
      Console.error(np.result);
      process.exit(1);
    }
    np.result.local = PackageJSON.result.local;
    await WritePackageJSON(
      process.cwd(),
      JSON.stringify(np.result, undefined, 2)
    );
    await GenerateLockFileAtCwd();
    await BulkRemovePackagesFromLocalCwdStore(process.cwd(), Packages, true);
  }
  build(program: typeof CommanderProgram) {
    program
      .command("remove <packages...>")
      .allowUnknownOption(true)
      .description(
        "Remove a package to your project. Any Unknown Options will be sent to the package manager."
      )
      .option("-pm, --package-manager <string>", "The package manager to use.")
      .option(
        "--skip-lock-check [boolean]",
        "Skips checking for package within the lock file."
      )
      .option(
        "--skip-registry-check [boolean]",
        "Skips checking for package within the local registry. This may be useful for uninstalling unpublished packages."
      )
      .option(
        "-log, --show-pm-logs [boolean]",
        "Show package managers output in terminal."
      )
      .action((packages, options) => {
        this.Remove(packages, options);
      });
  }
}
