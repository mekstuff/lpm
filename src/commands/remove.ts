import chalk from "chalk";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { GetPreferredPackageManager } from "./add-link.js";
import logreport from "../utils/logreport.js";
import {
  GenerateLockFileAtCwd,
  ReadLockFileFromCwd,
  RemoveInstallationsFromGlobalPackage,
} from "../utils/lpmfiles.js";
import { exec } from "child_process";
import { BulkRemovePackagesFromLocalCwdStore } from "./add.js";

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
      Options.packageManager = GetPreferredPackageManager();
    }
    logreport.assert(
      SUPPORTED_PACKAGE_MANAGERS.indexOf(Options.packageManager as string) !==
        -1,
      `Unsupported package manager "${Options.packageManager}"`
    );
    const Packages: string[] = [];
    const PackageManagerFlags: string[] = [];
    Arg0.forEach((arg) => {
      if (!arg.match("^-")) {
        Packages.push(arg);
      } else {
        PackageManagerFlags.push(arg);
      }
    });
    logreport.Elapse(
      `Removing ${Packages.length} package${Packages.length === 1 ? "" : "s"}.`,
      "REMOVE_PKGS"
    );
    Packages.forEach(async (pkg, index) => {
      logreport.Elapse(
        `Fetching package ${chalk.blue(pkg)} [${index + 1} / ${
          Packages.length
        }]...`,
        "REMOVE_PKGS"
      );
      if (!Options.skipLockCheck) {
        if (!LOCKFILE.pkgs[pkg]) {
          logreport.error(
            pkg +
              " was not found in lock file. use `--skip-lock-check` to ignore this check."
          );
        }
      }
    });

    logreport.Elapse(`Removing from global installations...`, "REMOVE_PKGS");
    try {
      await RemoveInstallationsFromGlobalPackage(Packages, [process.cwd()]);
    } catch (e) {
      if (!Options.skipRegistryCheck) {
        logreport.error(e);
      }
    }
    logreport.Elapse(
      `Finished removing from global installations`,
      "REMOVE_PKGS"
    );

    logreport.Elapse(
      `Removing from package manager ${chalk.blue(Options.packageManager)}...`,
      "REMOVE_PKGS"
    );

    const execString =
      Options.packageManager +
      " remove " +
      Packages.join(" ") +
      PackageManagerFlags.join(" ");
    logreport(`Executing "${execString}"`, "VERBOSE");
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
          logreport(
            data.toString(),
            "log",
            chalk.blue(Options.packageManager?.toUpperCase() + " INFO ")
          );
        }
      });
      executed.stderr?.on("data", (data) => {
        if (Options.showPmLogs) {
          logreport(
            data.toString(),
            "log",
            chalk.blue(Options.packageManager?.toUpperCase() + " INFO ")
          );
        }
      });
    });
    logreport(`Exit Code "${await p}"`, "VERBOSE");
    logreport.Elapse(
      `Removed from package manager with exit code ${await p}`,
      "REMOVE_PKGS"
    );
    await BulkRemovePackagesFromLocalCwdStore(process.cwd(), Packages, true);
    logreport.Elapse(`Generating LOCK file...`, "REMOVE_PKGS");
    await GenerateLockFileAtCwd();
    logreport.Elapse(`LOCK file Generated`, "REMOVE_PKGS", true);
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
