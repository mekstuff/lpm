import chalk from "chalk";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { GetPreferredPackageManager } from "./add-link.js";
import logreport from "../utils/logreport.js";
import {
  GenerateLockFileAtCwd,
  ReadLockFileFromCwd,
  RemoveInstallationsToGlobalPackage,
} from "../utils/lpmfiles.js";
import { exec } from "child_process";

interface RemoveOptions {
  packageManager?: SUPPORTED_PACKAGE_MANAGERS;
  skipLockCheck?: boolean;
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
    logreport.logwithelapse(
      `Removing ${Packages.length} package${Packages.length === 1 ? "" : "s"}.`,
      "REMOVE_PKGS"
    );
    Packages.forEach(async (pkg, index) => {
      logreport.logwithelapse(
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

    logreport.logwithelapse(
      `Removing from global installations...`,
      "REMOVE_PKGS"
    );
    await RemoveInstallationsToGlobalPackage(Packages, [process.cwd()]);
    logreport.logwithelapse(
      `Finished removing from global installations`,
      "REMOVE_PKGS"
    );

    logreport.logwithelapse(
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
    logreport.logwithelapse(
      `Removed from package manager with exit code ${await p}`,
      "REMOVE_PKGS"
    );

    logreport.logwithelapse(`Generating LOCK file...`, "REMOVE_PKGS");
    await GenerateLockFileAtCwd();
    logreport.logwithelapse(`LOCK file Generated`, "REMOVE_PKGS", true);
  }
  build(program: typeof CommanderProgram) {
    program
      .command("remove <packages...>")
      .allowUnknownOption(true)
      .description(
        "Remove a package to your project. Any Unknown Options will be sent to the package manager."
      )
      .option("-pm, --package-manager [string]", "The package manager to use.")
      .option(
        "--skip-lock-check [string]",
        "Skips checking for package within the lock file."
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
