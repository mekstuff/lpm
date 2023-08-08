//TODO: if xd2 imports xd and xd4 adds xd2, since xd2 imported xd, the resolve is a .lpm folder in root
//To fix might just need to have resolvepackaes run when installing, so it checks for imported packages of added packages.

import fs from "fs";
import chalk from "chalk";
import logreport from "../utils/logreport.js";
import pluralize from "pluralize";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import {
  AddInstallationsToGlobalPackage,
  GenerateLockFileAtCwd,
  RequireFileChangeGenerateObj,
  GetLPMPackagesJSON,
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
  ResolvePackageFromLPMJSON,
  IAddInstallationsToGlobalPackage_Package,
  dependency_scope,
  GetPackageFromLockFileByName,
} from "../utils/lpmfiles.js";
import path from "path";
import { execSync } from "child_process";

import {
  PackageFile,
  ParsePackageName,
  ReadPackageJSON,
  WritePackageJSON,
} from "../utils/PackageReader.js";

export function GetPreferredPackageManager(): SUPPORTED_PACKAGE_MANAGERS {
  return "yarn";
}
export interface AddOptions {
  packageManager?: SUPPORTED_PACKAGE_MANAGERS;
  showPmLogs?: boolean;
  import?: boolean;
  dev?: boolean;
  peer?: boolean;
  optional?: boolean;
  traverseImports?: boolean;
  preserveImport?: boolean;
}

/**
 * Bulk removes packages then generates a new seal to remove unwanted packages
 */
export async function BulkRemovePackagesFromLocalCwdStore(
  cwd: string,
  packages: string[],
  noErrors?: boolean
) {
  packages.map(async (p) => {
    await RemovePackageFromLocalCwdStore(cwd, p, noErrors);
  });
  const Seal = await GenerateLocalCwdTreeSeal(cwd);
  await RemoveUnwantedPackagesFromLpmLocalFromSeal(cwd, Seal);
}

/**
 * Called by bulk remove, to remove unwanted packages, use builkremove.
 */
async function RemovePackageFromLocalCwdStore(
  cwd: string,
  pkgName: string,
  noErrors?: boolean
) {
  const cwd_lpm_path = path.join(cwd, ".lpm");
  if (!fs.existsSync(cwd_lpm_path)) {
    return;
  }
  const ParsedInfo = ParsePackageName(pkgName);
  try {
    fs.rmSync(path.join(cwd_lpm_path, ParsedInfo.FullResolvedName), {
      recursive: true,
      force: true,
    });
    if (fs.readdirSync(cwd_lpm_path).length === 0) {
      fs.rmSync(cwd_lpm_path, { recursive: true, force: true });
    }
  } catch (err) {
    if (!noErrors) {
      logreport.error(
        "Could not remove package from => " +
          path.join(cwd_lpm_path, ParsedInfo.FullResolvedName)
      );
    }
  }
}

type TreeSealArray = {
  [key: string]: {
    installs: {
      installdir: string;
      dependency_scope: dependency_scope;
    }[];
    resolve: string;
  };
};

/**
 * Called recursively until all packages dependencies are resolved.
 * @param rootDirectory is automatically set, refers to the root directory of the initial call, will be the initial targetDirectory
 * @param depOfDep Is automatically set, refers to the package in which the dep is installed, at top level it will be rootDirectory.
 * @param traverseFolliwingImports If a parent directory has traverse-imports to true, then we will traverse imports of every descendant of that.
 */
async function GetDirectoryDependenciesForCwdTreeSeal(
  TargetDirectory: string,
  TreeSealArray: TreeSealArray,
  rootDirectory?: string,
  depOfDep?: string,
  traverseFolliwingImports?: boolean
) {
  const LPMLOCK = await ReadLockFileFromCwd(TargetDirectory, undefined, true);
  if (!LPMLOCK) {
    return false;
  }
  if (!rootDirectory) {
    rootDirectory = TargetDirectory;
  }

  for (const p in LPMLOCK.pkgs) {
    const tp = LPMLOCK.pkgs[p];
    if (tp.traverse_imports) {
      traverseFolliwingImports = true;
    }
    const n = p + "--" + tp.publish_sig;
    if (tp.install_type !== "import" && !traverseFolliwingImports) {
      continue;
    }
    if (!TreeSealArray[n]) {
      TreeSealArray[n] = {
        installs: [],
        resolve: tp.resolve,
      };
    }
    TreeSealArray[n].installs.push({
      installdir: depOfDep
        ? path.join(rootDirectory, ".lpm", depOfDep)
        : rootDirectory,
      dependency_scope: tp.dependency_scope,
    });
    await GetDirectoryDependenciesForCwdTreeSeal(
      tp.resolve,
      TreeSealArray,
      rootDirectory,
      n,
      traverseFolliwingImports
    );
  }
}

/**
 * Generates a tree seal array from the rootDirectory
 */
async function GenerateLocalCwdTreeSeal(
  rootDirectory: string
): Promise<TreeSealArray> {
  const store_cache_path = path.join(rootDirectory, ".lpm", ".lpm-seal.lock");
  if (fs.existsSync(store_cache_path)) {
    fs.rmSync(store_cache_path, { recursive: true, force: true });
    fs.mkdirSync(store_cache_path, { recursive: true });
  }
  const CArray: TreeSealArray = {};
  await GetDirectoryDependenciesForCwdTreeSeal(rootDirectory, CArray);
  return CArray;
}

/**
 * Resolves packages from the tree seal data, adding them to the .lpm dir and updating any dependeant package.json file.
 */
async function ResolvePackagesFromTreeSeal(
  rootDirectory: string,
  Seal: TreeSealArray
) {
  const lpmdir = path.join(rootDirectory, ".lpm");
  let linkinstalls: {
    pkg: string;
    parsedpkgname: string;
    installdir: string;
    dependency_scope: dependency_scope;
  }[] = [];
  for (const pkg in Seal) {
    const ns = pkg.split("--");
    const ParsedInfo = ParsePackageName(ns[0]);
    const v = Seal[pkg];
    const dir = path.join(lpmdir, pkg);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.cpSync(v.resolve, dir, { recursive: true, force: true });
    linkinstalls = [
      ...linkinstalls,
      ...v.installs.map((x) => {
        return {
          pkg: pkg,
          parsedpkgname: ParsedInfo.FullPackageName,
          installdir: x.installdir,
          dependency_scope: x.dependency_scope,
        };
      }),
    ];
  }
  //linking installs
  for (const x of linkinstalls) {
    const PackageJSONOfInstall = await ReadPackageJSON(x.installdir);
    if (
      !PackageJSONOfInstall.success ||
      typeof PackageJSONOfInstall.result === "string"
    ) {
      continue;
    }
    if (!PackageJSONOfInstall.result[x.dependency_scope]) {
      PackageJSONOfInstall.result[x.dependency_scope] = {};
    }
    await RemovePackageNameFromDependencyScopes(
      x.parsedpkgname,
      PackageJSONOfInstall.result
    );
    //@ts-expect-error ^^ sets object but following assumes it can be undefined.
    PackageJSONOfInstall.result[x.dependency_scope][
      x.parsedpkgname
    ] = `file:${path.join(path.relative(x.installdir, lpmdir), x.pkg)}`;
    await WritePackageJSON(
      x.installdir,
      JSON.stringify(PackageJSONOfInstall.result, undefined, 2)
    );
  }
}

/**
 * Any packages that aren't listed in treeseal array will be removed if exists.
 */
async function RemoveUnwantedPackagesFromLpmLocalFromSeal(
  rootDirectory: string,
  Seal: TreeSealArray
) {
  const lpmdir = path.join(rootDirectory, ".lpm");
  if (!fs.existsSync(lpmdir)) {
    return;
  }
  const indir = fs.readdirSync(lpmdir);
  let removed = 0;
  for (const f of fs.readdirSync(lpmdir)) {
    if (!Seal[f]) {
      fs.rmSync(path.join(lpmdir, f), { recursive: true, force: true });
      removed++;
    }
  }
  if (removed === indir.length) {
    fs.rmSync(lpmdir, { recursive: true, force: true });
  }
}

/**
 * For handling injecting a package.
 */
async function HandleInjectPackage(
  cwd: string,
  Inject: RequireFileChangeGenerateObj
) {
  const parsed = ParsePackageName(Inject.name);
  const node_modules = path.join(cwd, "node_modules");
  const name_node_modules = path.join(node_modules, parsed.FullPackageName);
  if (fs.existsSync(name_node_modules)) {
    fs.rmSync(name_node_modules, { recursive: true, force: true });
  }
  //update in node_modules
  fs.cpSync(Inject.resolve, name_node_modules, {
    recursive: true,
    force: true,
  });
}

/**
 * Removes package from the package.json dependency list.
 */
async function RemovePackageNameFromDependencyScopes(
  PackageName: string,
  packageFileResults: PackageFile
) {
  const t = [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
    "devDependencies",
  ];
  for (const d of t) {
    if (packageFileResults[d as dependency_scope]) {
      //@ts-expect-error ^^ sets object but following assumes it can be undefined.
      packageFileResults[d as dependency_scope][PackageName] =
        undefined as unknown as string;
    }
  }
}

/**
 * Adds file from the data generated by the lock, installing packages that are required to be installed and injecting those required to be injected.
 */
export async function AddFilesFromLockData(
  PackageManager: SUPPORTED_PACKAGE_MANAGERS,
  log: boolean | undefined,
  cwd: string,
  ToInstall: RequireFileChangeGenerateObj[],
  ToInject: RequireFileChangeGenerateObj[]
) {
  let useSeal: TreeSealArray | undefined;
  let MUST_RESOLVE_PACKAGES_FROM_useSEAL = false;
  if (ToInject.length > 0) {
    logreport(
      `Injecting ${ToInject.length} ${pluralize(
        "dependency",
        ToInject.length
      )}.`,
      "log",
      true
    );
    for (const inject of ToInject) {
      await HandleInjectPackage(cwd, inject);
    }
    useSeal = await GenerateLocalCwdTreeSeal(cwd);
    //We do not resolve seals here, if anything is to install then resolve seal if not, resolve seal, so it's only called once instead of twice if both toinstall and toinject is ran.
    MUST_RESOLVE_PACKAGES_FROM_useSEAL = true;
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
    const Seal = useSeal || (await GenerateLocalCwdTreeSeal(cwd));
    useSeal = Seal;
    await ResolvePackagesFromTreeSeal(cwd, Seal);
    //we read after sealing since sealing may change the package json, might aswell just pass as param to seal in future.
    const cwdJSON = await ReadPackageJSON(cwd);
    if (!cwdJSON.success || typeof cwdJSON.result === "string") {
      logreport.error(
        `${cwd} does not have a package.json file. => ${cwdJSON.result}`
      );
      process.exit(1);
    }
    for (const i of ToInstall) {
      if (i.install_type !== "default") {
        //imports are handled through `ResolvePackagesFromTreeSeal`
        continue;
      }
      const parsed = ParsePackageName(i.name);
      await RemovePackageNameFromDependencyScopes(
        parsed.FullPackageName,
        cwdJSON.result
      );
      cwdJSON.result[i.dependency_scope] =
        cwdJSON.result[i.dependency_scope] || {};
      //@ts-expect-error ^^ sets object but following assumes it can be undefined.
      cwdJSON.result[i.dependency_scope][
        parsed.FullPackageName
      ] = `file:${i.resolve}`;
    }
    await WritePackageJSON(cwd, JSON.stringify(cwdJSON.result, undefined, 2));
    try {
      execSync(`${PackageManager}`, {
        cwd: cwd,
        stdio: log ? "inherit" : "ignore",
      });
    } catch (err) {
      console.error(err);
      logreport.error(err);
    }
  } else {
    if (MUST_RESOLVE_PACKAGES_FROM_useSEAL && useSeal) {
      await ResolvePackagesFromTreeSeal(cwd, useSeal); //if packages were injected and nothing was installed, we need to resolve, since we don't resolve after injection since resolve will be called twice if there's any installs.
      await RemoveUnwantedPackagesFromLpmLocalFromSeal(cwd, useSeal);
    }
    logreport("Up to date.", "log", true);
    return;
  }
}

export default class add {
  async Add(Arg0: string[], Options: AddOptions) {
    if (Options.traverseImports && !Options.import) {
      logreport.error("You cannot set traverse-imports without importing .");
      process.exit(1);
    }
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
    const AddToInstallationsData: IAddInstallationsToGlobalPackage_Package[] =
      [];
    Arg0.forEach((arg) => {
      if (!arg.match("^-")) {
        Packages.push(arg);
      } else {
        PackageManagerFlags.push(arg);
      }
    });
    const GlobalPkgsIndex = await ReadLPMPackagesJSON();
    const LOCKFILE = await ReadLockFileFromCwd(undefined, true, true);
    for (const index in Packages) {
      let pkg = Packages[index];
      logreport.Elapse(
        `Fetching package ${chalk.blue(pkg)} [${Number(index) + 1} / ${
          Packages.length
        }]...`,
        "INSTALL_PKGS"
      );
      let KEEP_CURRENT_VERSION_WHEN_RESOLVE = false;
      const InitialNameParse = ParsePackageName(pkg);
      //if we are requiring latest, check if it's already installed and install latest relative to previously installed.
      if (InitialNameParse.PackageVersion === "latest") {
        if (LOCKFILE) {
          for (const PKG in LOCKFILE.pkgs) {
            // const t = LOCKFILE.pkgs[PKG];
            const p = ParsePackageName(PKG);
            if (p.FullPackageName === InitialNameParse.FullPackageName) {
              //update the pkg string so when fetching it will use that @version instead of @latest.
              //if version was @latest and no semver symbol is set, use ^
              pkg = `${p.FullPackageName}@${LOCKFILE.pkgs[PKG].sem_ver_symbol}${p.PackageVersion}`;
              break;
            }
          }
        }
      } else {
        KEEP_CURRENT_VERSION_WHEN_RESOLVE = true;
      }
      const InGlobalIndex = await ResolvePackageFromLPMJSON(
        pkg,
        GlobalPkgsIndex,
        KEEP_CURRENT_VERSION_WHEN_RESOLVE
      );
      if (!InGlobalIndex) {
        logreport.error(
          `"${pkg}" was not found within the local package registry.`
        );
        process.exit(1);
      }
      logreport.assert(
        typeof InGlobalIndex.Package.resolve === "string",
        `"${pkg}" Package does not have a valid resolve field in global index! ${await GetLPMPackagesJSON()}`
      );
      logreport.assert(
        typeof InGlobalIndex.Package.installations === "object",
        `"${pkg}" Package does not have a valid installations field in global index! ${await GetLPMPackagesJSON()}`
      );
      if (!Options.import && InGlobalIndex.Package.requires_import === true) {
        logreport.error(
          `"${pkg}" requires to be imported, try ${chalk.bold(
            `lpm import ${pkg}`
          )}`
        );
      }
      //Add fetch package from lock file by name function to get old version.
      const CURR_LOCK_FILE_DATA =
        LOCKFILE &&
        (await GetPackageFromLockFileByName(
          InGlobalIndex.Parsed.FullPackageName,
          process.cwd(),
          LOCKFILE
        ));
      let FORCE_USE_DEPENDENCY_SCOPE: dependency_scope | undefined;
      if (
        CURR_LOCK_FILE_DATA &&
        !Options.dev &&
        !Options.optional &&
        !Options.peer
      ) {
        //if none provided, use old install dep scope from lock file if exists.
        FORCE_USE_DEPENDENCY_SCOPE = CURR_LOCK_FILE_DATA.dependency_scope;
      }

      //keep import and traverse state
      if (CURR_LOCK_FILE_DATA) {
        if (CURR_LOCK_FILE_DATA.traverse_imports === true) {
          Options.traverseImports = true;
        }
        if (CURR_LOCK_FILE_DATA.install_type === "import") {
          if (!Options.import) {
            if (!Options.preserveImport) {
              logreport.warn(
                `${InGlobalIndex.Parsed.FullResolvedName} was previously imported but now is a default installation.`
              );
            } else {
              logreport(
                `Preserved import for ${InGlobalIndex.Parsed.FullResolvedName}`,
                "log",
                true
              );
              Options.import = true;
            }
          }
        } else if (CURR_LOCK_FILE_DATA.install_type === "default") {
          if (Options.import) {
            logreport.warn(
              `${InGlobalIndex.Parsed.FullResolvedName} was previously a default installation but is now imported.`
            );
          }
        }
      }
      AddToInstallationsData.push({
        packageName: InGlobalIndex.Parsed.FullSemVerResolvedName,
        installInfo: {
          path: process.cwd(),
          install_type: Options.import ? "import" : "default",
          traverse_imports: Options.traverseImports || false,
          dependency_scope: FORCE_USE_DEPENDENCY_SCOPE
            ? FORCE_USE_DEPENDENCY_SCOPE
            : Options.dev
            ? "devDependencies"
            : Options.optional
            ? "optionalDependencies"
            : Options.peer
            ? "peerDependencies"
            : "dependencies",
        },
      });
    }
    await AddInstallationsToGlobalPackage(AddToInstallationsData);
    const { RequiresInstall, RequiresNode_Modules_Injection } =
      await GenerateLockFileAtCwd();
    await AddFilesFromLockData(
      Options.packageManager,
      Options.showPmLogs,
      process.cwd(),
      RequiresInstall,
      RequiresNode_Modules_Injection
    );
  }
  build(program: typeof CommanderProgram) {
    program
      .command("add <packages...>")
      .allowUnknownOption(true)
      .description(
        "Add a package to your project. Any Unknown Options will be sent to the package manager."
      )
      .option("-pm, --package-manager [string]", "The package manager to use.")
      .option("-D, --dev", "Save as dev dependency")
      .option("-P, --peer", "Save as dev dependency")
      .option("-O, --optional", "Save as optional dependency")
      .option(
        "--traverse-imports",
        "Makes it so every imported package dependency is imported aswell. e.g `pkg1` has dependency of `pkg2`, `pkg1` does not import `pkg2`, when `pkg3` installs `pkg1` to have pkg2 to be imported aswell, use this flag. "
      )
      .option(
        "--preserve-import",
        "If previously imported and you try to add without --import, you will be prompted. Setting this keeps import as true"
      )
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
