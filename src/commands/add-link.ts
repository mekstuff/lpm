import chalk from "chalk";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import {
  AddInstallationsToGlobalPackage,
  GenerateLockFileAtCwd,
  GetLPMPackagesJSON,
  ReadLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import { execSync } from "child_process";

export interface AddOptions {
  packageManager?: SUPPORTED_PACKAGE_MANAGERS;
  showPmLogs?: boolean;
}

export function GetPreferredPackageManager(): SUPPORTED_PACKAGE_MANAGERS {
  return "yarn";
}

export default class AddLink {
  async Add(Arg0: string[], Options: AddOptions) {
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
      `Installing ${Packages.length} package${
        Packages.length === 1 ? "" : "s"
      }.`,
      "INSTALL_PKGS"
    );
    // let execString = "";
    let InstallPkgsCommandStr = "";
    const GlobalPkgsIndex = await ReadLPMPackagesJSON();
    for (const index in Packages) {
      const pkg = Packages[index];
      logreport.logwithelapse(
        `Fetching package ${chalk.blue(pkg)} [${Number(index) + 1} / ${
          Packages.length
        }]...`,
        "INSTALL_PKGS"
      );
      const InGlobalIndex = GlobalPkgsIndex.packages[pkg];
      if (!InGlobalIndex) {
        logreport.error(
          `"${pkg}" was not found within the local package registry.`
        );
      }
      logreport.assert(
        typeof InGlobalIndex.resolve === "string",
        `"${pkg}" Package does not have a valid resolve field in global index! ${await GetLPMPackagesJSON()}`
      );
      logreport.assert(
        typeof InGlobalIndex.installations === "object",
        `"${pkg}" Package does not have a valid installations field in global index! ${await GetLPMPackagesJSON()}`
      );
      let str = InGlobalIndex.resolve;
      if (Options.packageManager !== "npm") {
        str = "link:" + str;
      }
      InstallPkgsCommandStr += str + " ";
    }

    await AddInstallationsToGlobalPackage(Packages, [process.cwd()]);
    logreport.logwithelapse(
      `Finished Adding to global installations`,
      "INSTALL_PKGS"
    );
    logreport.logwithelapse(
      `Installing with package manager ${chalk.blue(
        Options.packageManager
      )}...`,
      "INSTALL_PKGS"
    );
    const execString =
      Options.packageManager +
      ` ${Options.packageManager === "yarn" ? "add" : "install"} ` +
      InstallPkgsCommandStr +
      PackageManagerFlags.join(" ");

    logreport(`Executing "${execString}"`, "VERBOSE");
    // const p = new Promise<number | null>((resolve) => {
    const executed = execSync(execString, {
      stdio: (Options.showPmLogs && "inherit") || "ignore",
    });
    /*
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
    */

    logreport(`Exit Code "${executed}"`, "VERBOSE");

    logreport.logwithelapse(
      `Installed with package manager with exit code ${executed}`,
      "INSTALL_PKGS"
    );

    logreport.logwithelapse(`Generating LOCK file...`, "INSTALL_PKGS");
    await GenerateLockFileAtCwd();
    logreport.logwithelapse(`LOCK file Generated`, "INSTALL_PKGS", true);
  }
  build(program: typeof CommanderProgram) {
    program
      .command("addlink <packages...>")
      .allowUnknownOption(true)
      .description(
        "Add a package to your project by using link: protocol (refer to add instead since addlink can result unwanted behaviour). Any Unknown Options will be sent to the package manager."
      )
      .option("-pm, --package-manager [string]", "The package manager to use.")
      .option(
        "-log, --show-pm-logs [boolean]",
        "Show package managers output in terminal.",
        false
      )
      .action((packages, options) => {
        this.Add(packages, options);
      });
  }
}
