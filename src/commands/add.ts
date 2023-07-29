import fs from "fs";
import LogTree, { Tree } from "console-log-tree";
import chalk from "chalk";
import logreport from "../utils/logreport.js";
import pluralize from "pluralize";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { GetPreferredPackageManager } from "./add-link.js";
import {
  AddInstallationsToGlobalPackage,
  GenerateLockFileAtCwd,
  RequireFileChangeGenerateObj,
  GetLPMPackagesJSON,
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
} from "../utils/lpmfiles.js";
import path from "path";
import { execSync } from "child_process";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";

export interface AddOptions {
  packageManager?: SUPPORTED_PACKAGE_MANAGERS;
  showPmLogs?: boolean;
}

export async function AddFilesFromLockData(
  PackageManager: SUPPORTED_PACKAGE_MANAGERS,
  log: boolean | undefined,
  targetCwd: string | undefined,
  ToInstall: RequireFileChangeGenerateObj[],
  ToInject: RequireFileChangeGenerateObj[]
) {
  const cwd = targetCwd ? targetCwd : process.cwd();
  const LOCKFILE = await ReadLockFileFromCwd(cwd);
  const TargetPkgs: (typeof LOCKFILE)["pkgs"] = {};
  if (ToInject.length > 0) {
    logreport(
      `Injecting ${ToInject.length} ${pluralize(
        "dependency",
        ToInject.length
      )}.`,
      "log",
      true
    );
    for (const val of ToInject) {
      const { OrginizationName, PackageName } = await ParsePackageName(
        val.name
      );
      const p = path.join(cwd, "node_modules", val.name);
      try {
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
        }
        fs.cpSync(
          val.data.resolve,
          path.join(cwd, "node_modules", OrginizationName, PackageName),
          { recursive: true }
        );
      } catch (e) {
        logreport.error(`Failed to inject package ${val.name} => ${e}`);
      }
    }
  }
  if (ToInstall.length > 0) {
    logreport(
      `Updating ${ToInstall.length} ${pluralize(
        "dependency",
        ToInstall.length
      )}.`,
      "log",
      true
    );
    for (const val of ToInstall) {
      TargetPkgs[val.name] = {
        resolve: val.data.resolve,
        publish_sig: val.data.publish_sig,
      };
    }
  } else {
    logreport("Up to date.", "log", true);
    return;
  }

  /* FOR RESOLVE LOCALLY IN .lpm FOLDER
  const cwd_lpm_path = path.join(cwd, ".lpm");
  if (!fs.existsSync(cwd_lpm_path)) {
    try {
      fs.mkdirSync(cwd_lpm_path, { recursive: true });
    } catch (e) {
      logreport.error(`Could not create ${cwd_lpm_path}. => ${e}`);
      process.exit(1);
    }
  }
  */
  type DEPSDATA = { name: string; install: string };
  const NORMAL_DEPS: DEPSDATA[] = [];
  const DEV_DEPS: DEPSDATA[] = [];

  for (const pkgName in TargetPkgs) {
    const pkg = TargetPkgs[pkgName];
    /* FOR RESOLVE LOCALLY IN .lpm FOLDER
    const pkgNameSplit = pkgName.split("/");
    let Orginization: string | undefined;
    let Package: string;
    if (pkgNameSplit.length > 1) {
      Orginization = pkgNameSplit[0];
      Package = pkgNameSplit[1];
    } else {
      Package = pkgName;
    }
    const InstallationPath = path.join(
      cwd_lpm_path,
      Orginization ? Orginization : "",
      Package
    );
    
    if (
      Orginization !== undefined &&
      !fs.existsSync(path.join(cwd_lpm_path, Orginization))
    ) {
      try {
        fs.mkdirSync(path.join(cwd_lpm_path, Orginization), {
          recursive: true,
        });
      } catch (e) {
        logreport.error(
          `Could not create originization scope path for "${Orginization}". => ${e}`
          );
          process.exit(1);
        }
      }
      */
    try {
      /* FOR RESOLVE LOCALLY IN .lpm FOLDER
      fs.cpSync(pkg.resolve, InstallationPath, {
        force: true,
        recursive: true,
      });
      const str = `file:${path.relative(cwd, InstallationPath)}`;
      */
      const str = `file:${pkg.resolve}`;
      const data = {
        name: pkgName,
        install: str,
      };
      if (pkg.dependencyScope === "devDependency") {
        DEV_DEPS.push(data);
      } else {
        NORMAL_DEPS.push(data);
      }
    } catch (err) {
      logreport.error(`Failed to copy pkg "${pkgName}" => ${err}`);
    }
  }
  const PackageJSON = await ReadPackageJSON(cwd, undefined, true);
  if (!PackageJSON.success || typeof PackageJSON.result === "string") {
    logreport.error("Could not read package json => " + PackageJSON.result);
    process.exit(1);
  }

  const tree: Tree[] = [];

  const forEachDep = (deps: DEPSDATA[], depFlag?: string) => {
    if (deps.length <= 0) {
      return;
    }
    const showTreeInfo: Tree[] = [];
    let str = `${PackageManager}${depFlag ? " --" + depFlag : ""} add `;
    deps.map((x) => {
      showTreeInfo.push({
        name: x.name,
      });
      str += x.install + " ";
    });
    try {
      execSync(str, { cwd: cwd, stdio: log ? "inherit" : "ignore" });
    } catch (e) {
      logreport.error(e);
      process.exit(1);
    }
    tree.push({
      name: depFlag ? depFlag.toUpperCase() + " DEPS" : "DEPS",
      children: showTreeInfo,
    });
    /*
    const result = PackageJSON.result as { [key: string]: any };
    for (const d of deps) {
      if (!result[depScope]) {
        result[depScope] = {};
      }
      result[depScope][d.name] = d.install;
    }
    PackageJSON.result = result;
    */
  };
  try {
    forEachDep(NORMAL_DEPS);
    forEachDep(DEV_DEPS, "--dev");
    console.log(LogTree.parse(tree));
  } catch (err) {
    logreport.error(
      `Failed to install packages with ${chalk.blue(
        PackageManager
      )} => ${chalk.red(err)}`
    );
  }
}

export default class add {
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
    // let execString = "";
    const GlobalPkgsIndex = await ReadLPMPackagesJSON();
    const PKGS_RESOLVES: { name: string; resolve: string }[] = [];
    for (const index in Packages) {
      const pkg = Packages[index];
      logreport.Elapse(
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
      PKGS_RESOLVES.push({
        name: pkg,
        resolve: InGlobalIndex.resolve,
      });
    }
    await AddInstallationsToGlobalPackage(Packages, [process.cwd()]);
    const { RequiresInstall, RequiresNode_Modules_Injection } =
      await GenerateLockFileAtCwd();
    await AddFilesFromLockData(
      Options.packageManager,
      Options.showPmLogs,
      undefined,
      RequiresInstall,
      RequiresNode_Modules_Injection
    );
    // await AddFilesFromLockData();
  }
  build(program: typeof CommanderProgram) {
    program
      .command("add <packages...>")
      .allowUnknownOption(true)
      .description(
        "Add a package to your project. Any Unknown Options will be sent to the package manager."
      )
      .option("-pm, --package-manager [string]", "The package manager to use.")
      .option(
        "-log, --show-pm-logs [boolean]",
        "Show package managers output in terminal.",
        false
      )
      .action(async (packages, options) => {
        await this.Add(packages, options);
      });
  }
}
