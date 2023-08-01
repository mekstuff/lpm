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
  ILPMPackagesJSON,
  ILPMPackagesJSON_Package,
  ILPMPackagesJSON_Package_installations_installtypes,
  LOCKFILEPKG,
} from "../utils/lpmfiles.js";
import path from "path";
import { execSync } from "child_process";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";

export interface AddOptions {
  packageManager?: SUPPORTED_PACKAGE_MANAGERS;
  showPmLogs?: boolean;
  import?: boolean;
}

export async function BulkRemovePackagesFromLocalCwdStore(
  cwd: string,
  packages: string[],
  noErrors?: boolean
) {
  packages.map(async (p) => {
    await RemovePackageFromLocalCwdStore(cwd, p, noErrors);
  });
}

async function RemovePackageFromLocalCwdStore(
  cwd: string,
  pkgName: string,
  noErrors?: boolean
) {
  const cwd_lpm_path = path.join(cwd, ".lpm");
  if (!fs.existsSync(cwd_lpm_path)) {
    return;
  }
  try {
    fs.rmSync(path.join(cwd_lpm_path, pkgName), {
      recursive: true,
      force: true,
    });
    if (fs.readdirSync(cwd_lpm_path).length === 0) {
      fs.rmSync(cwd_lpm_path, { recursive: true, force: true });
    }
  } catch (err) {
    if (!noErrors) {
      logreport.error(
        "Could not remove package from => " + path.join(cwd_lpm_path, pkgName)
      );
    }
  }
}

async function AddPackageToLocalCwdStore(
  cwd: string,
  pkgName: string,
  pkg: Pick<LOCKFILEPKG, "install_type" | "resolve">
): Promise<string> {
  const cwd_lpm_path = path.join(cwd, ".lpm");
  if (!fs.existsSync(cwd_lpm_path)) {
    try {
      fs.mkdirSync(cwd_lpm_path, { recursive: true });
    } catch (e) {
      logreport.error(`Could not create ${cwd_lpm_path}. => ${e}`);
      process.exit(1);
    }
  }
  const pkgNameSplit = pkgName.split("/");
  let Orginization: string | undefined;
  let Package: string;
  if (pkgNameSplit.length > 1) {
    Orginization = pkgNameSplit[0];
    Package = pkgNameSplit[1];
  } else {
    Package = pkgName;
  }
  let InstallationPath = path.join(
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
  /* */
  try {
    /* FOR RESOLVE LOCALLY IN .lpm FOLDER */
    if (pkg.install_type === "import") {
      fs.cpSync(pkg.resolve, InstallationPath, {
        force: true,
        recursive: true,
      });
      InstallationPath = path.relative(cwd, InstallationPath);
    }
    /* */
  } catch (err) {
    logreport.error(`Failed to copy pkg "${pkgName}" => ${err}`);
  }
  return InstallationPath;
}

/**
 * TODO: Since add injects modules, It updates dependencies without publishing/pushing. This behaviour may need to be changed
 */
const InjectToNode_Modules = async (
  name: string,
  resolve: string,
  WORKING_DIRECTORY: string,
  install_type: ILPMPackagesJSON_Package_installations_installtypes
) => {
  // await RemovePackageFromLocalCwdStore(WORKING_DIRECTORY, name, true);
  console.log(install_type);
  if (install_type === "import") {
    /**
     * Update resolve to use the local cwd store instead.
     */
    resolve = await AddPackageToLocalCwdStore(WORKING_DIRECTORY, name, {
      install_type: install_type,
      resolve,
    });
  }
  const { OrginizationName, PackageName } = await ParsePackageName(name);
  const p = path.join(WORKING_DIRECTORY, "node_modules", name);
  try {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
    fs.cpSync(
      resolve,
      path.join(
        WORKING_DIRECTORY,
        "node_modules",
        OrginizationName,
        PackageName
      ),
      { recursive: true }
    );
  } catch (e) {
    logreport.error(`Failed to inject package ${name} => ${e}`);
  }
};

const ForEachInjectInstallation = async (
  // installations: string[],
  installations: ILPMPackagesJSON_Package["installations"],
  name: string,
  resolve: string,
  LPMPackages: ILPMPackagesJSON["packages"]
) => {
  for (const x of installations) {
    await InjectToNode_Modules(name, resolve, x.path, x.install_type);
    // console.log("\nHERE: ", x, name, "\n");
    const { success, result } = await ReadPackageJSON(x.path);
    if (!success || typeof result === "string") {
      continue;
    }
    const published = LPMPackages[result.name || ""];
    if (published) {
      await ForEachInjectInstallation(
        published.installations,
        name,
        resolve,
        LPMPackages
      );
    }
  }
};

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

    // const ALLTOINJECTDEPS = await GetAllDependenciesForInjection(ToInject);

    for (const val of ToInject) {
      await ForEachInjectInstallation(
        val.data.installations,
        val.name,
        val.data.resolve,
        (
          await ReadLPMPackagesJSON()
        ).packages
      );
      // await InjectToNode_Modules(val.name, val.data.resolve, cwd);
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
        install_type: val.install_type,
      };
    }
  } else {
    logreport("Up to date.", "log", true);
    return;
  }

  /* FOR RESOLVE LOCALLY IN .lpm FOLDER */

  /* */
  type DEPSDATA = { name: string; install: string };
  const NORMAL_DEPS: DEPSDATA[] = [];
  const DEV_DEPS: DEPSDATA[] = [];

  for (const pkgName in TargetPkgs) {
    let InstallationPath: string | undefined;
    const pkg = TargetPkgs[pkgName];
    /* FOR RESOLVE LOCALLY IN .lpm FOLDER */
    if (pkg.install_type === "import") {
      InstallationPath = await AddPackageToLocalCwdStore(cwd, pkgName, pkg);
    } else {
      InstallationPath = pkg.resolve;
    }
    if (InstallationPath === undefined) {
      logreport.error("Could not resolve installation path");
      process.exit(1);
    }

    const str = `file:${InstallationPath}`;
    const data = {
      name: pkgName,
      install: str,
    };
    if (pkg.dependencyScope === "devDependencies") {
      DEV_DEPS.push(data);
    } else {
      NORMAL_DEPS.push(data);
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
    console.log("\n" + LogTree.parse(tree));
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
      if (!Options.import && InGlobalIndex.requires_import === true) {
        logreport.error(
          `"${pkg}" requires to be imported, try ${chalk.bold(
            `lpm import ${pkg}`
          )}`
        );
      }
      PKGS_RESOLVES.push({
        name: pkg,
        resolve: InGlobalIndex.resolve,
      });
    }
    await AddInstallationsToGlobalPackage(Packages, [
      {
        path: process.cwd(),
        install_type: Options.import ? "import" : "default",
      },
    ]);
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
      .option(
        "--import [boolean]",
        "Adds the package to a .local-pm and install from local path, Useful for packages that aren't actually published to a registry."
      )
      .action(async (packages, options) => {
        await this.Add(packages, options);
      });
  }
}
