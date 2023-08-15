//TODO: if xd2 imports xd and xd4 adds xd2, since xd2 imported xd, the resolve is a .lpm folder in root
//To fix might just need to have resolvepackaes run when installing, so it checks for imported packages of added packages.

import fs from "fs";
import logreport from "../utils/logreport.js";
import pluralize from "pluralize";
import { program as CommanderProgram } from "commander";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import {
  GenerateLockFileAtCwd,
  RequireFileChangeGenerateObj,
  ReadLockFileFromCwd,
  ResolvePackageFromLPMJSON,
  dependency_scope,
  ResolvePackageFromLPMJSONFromDirectory,
} from "../utils/lpmfiles.js";
import path from "path";
import { execSync } from "child_process";

import {
  PackageFile,
  ParsePackageName,
  ReadPackageJSON,
  WritePackageJSON,
} from "../utils/PackageReader.js";

import enqpkg from "enquirer";
const { prompt } = enqpkg;

export async function GetPreferredPackageManager(): Promise<SUPPORTED_PACKAGE_MANAGERS> {
  return "yarn";
  return await prompt<{ pm: SUPPORTED_PACKAGE_MANAGERS }>({
    name: "pm",
    message: "Select a package manager",
    choices: ["yarn", "npm", "pnpm"],
    type: "select",
  })
    .then((e) => {
      return e.pm;
    })
    .catch((err) => {
      logreport.error(err);
      process.exit(1);
    });
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
  lockVersion?: boolean;
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
  // we need to also update this package where every else the current package using it is installed.
  // so if xd2 has xd installed. and xd3 has xd2 installed we need to inject xd in both xd2 and xd3.
  const cwdPublished = await ResolvePackageFromLPMJSONFromDirectory(cwd);
  if (cwdPublished) {
    cwdPublished.Package.installations.map(async (x) => {
      if (x.path === cwd) {
        logreport.warn(
          `${parsed.FullResolvedName} is published from ${cwd}. You tried to inject it here which will result in an infinite loop.`
        );
        return;
      }
      await HandleInjectPackage(x.path, Inject);
    });
  }
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
      )}. ${ToInject.map((x) => x.name).join(",")}`,
      "log",
      true
    );
    for (const inject of ToInject) {
      if (inject.requires_import === true && inject.install_type !== "import") {
        logreport.error(
          `${inject.name} is required to be imported. Could not inject.`
        );
      }
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
      )}. ${ToInstall.map((x) => x.name).join(",")}`,
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
    // remove .yarn-integrity since it if xd2 had a package installed and removed it, when adding updating xd2 in xd, xd will keep
    // the already removed package of xd2.
    if (fs.existsSync(path.join(cwd, "node_modules", ".yarn-integrity"))) {
      fs.rmSync(path.join(cwd, "node_modules", ".yarn-integrity"), {
        force: true,
        recursive: true,
      });
    }
    for (const i of ToInstall) {
      if (i.install_type !== "default") {
        //imports are handled through `ResolvePackagesFromTreeSeal`
        continue;
      }
      if (i.requires_import) {
        logreport.error(`${i.name} is required to be imported.`);
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
      execSync(
        `${PackageManager} ${PackageManager === "yarn" ? "" : "install"}`,
        {
          cwd: cwd,
          stdio: log ? "inherit" : "ignore",
        }
      );
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

async function AddPackagesToLocalPackageJSON(
  cwd: string,
  Packages: string[],
  dependency_scope: dependency_scope
) {
  const PackageJSON = await ReadPackageJSON(cwd);
  const l: PackageFile["local"] = {};
  l[dependency_scope] = l[dependency_scope] || {};
  Packages.map((x) => {
    const s = x.split(" ");
    const pn = ParsePackageName(s[0]);
    if (!pn.FullPackageName || !pn.PackageVersion) {
      logreport.error(`Failed to get package name or version. ${s[0]} => ${x}`);
      process.exit(1);
    }
    //if @current is passed, keep all the current data, including import, version etc. basically do not change the package.json for package.
    if (pn.PackageVersion === "current") {
      return;
    }
    if (PackageJSON.success && typeof PackageJSON.result !== "string") {
      const tl = PackageJSON.result.local;
      if (tl) {
        //remove from previous scope if listed.
        if (tl["dependencies"]) {
          tl["dependencies"][pn.FullPackageName] =
            undefined as unknown as string;
        }
        if (tl["devDependencies"]) {
          tl["devDependencies"][pn.FullPackageName] =
            undefined as unknown as string;
        }
        if (tl["peerDependencies"]) {
          tl["peerDependencies"][pn.FullPackageName] =
            undefined as unknown as string;
        }
        if (tl["optionalDependencies"]) {
          tl["optionalDependencies"][pn.FullPackageName] =
            undefined as unknown as string;
        }
      }
    }

    //xd@latest = *, xd@!1.4.5 = xd@1.4.5, xd@1.4.5 = xd@^1.4.5
    const opts = s.splice(1);
    const _x = l[dependency_scope] || {};
    _x[pn.FullPackageName] =
      opts.length > 0 ? [pn.VersionWithSymbol, ...opts] : pn.VersionWithSymbol;
    l[dependency_scope] = _x;
  });
  if (!PackageJSON.success || typeof PackageJSON.result === "string") {
    await WritePackageJSON(
      cwd,
      JSON.stringify({ local: l }, undefined, 2),
      undefined,
      true
    );
    return;
  } else {
    PackageJSON.result.local = PackageJSON.result.local || {};
    PackageJSON.result.local[dependency_scope] =
      PackageJSON.result.local[dependency_scope] || {};

    PackageJSON.result.local[dependency_scope] = {
      ...PackageJSON.result.local[dependency_scope],
      ...l[dependency_scope],
    };

    await WritePackageJSON(
      cwd,
      JSON.stringify(PackageJSON.result, undefined, 2)
    );
  }
}
export default class add {
  async Add(
    Arg0: string[],
    Options: AddOptions,
    targetWorkingDirectory?: string
  ) {
    targetWorkingDirectory = targetWorkingDirectory
      ? targetWorkingDirectory
      : process.cwd();
    if (Options.traverseImports && !Options.import) {
      logreport.error("You cannot set traverse-imports without importing .");
      process.exit(1);
    }
    if (!Options.packageManager) {
      Options.packageManager = await GetPreferredPackageManager();
    }
    logreport.assert(
      SUPPORTED_PACKAGE_MANAGERS.indexOf(Options.packageManager as string) !==
        -1,
      `Unsupported package manager "${Options.packageManager}"`
    );
    const Packages: string[] = [];
    const PackageManagerFlags: string[] = [];
    for (const arg of Arg0) {
      if (!arg.match("^-")) {
        let str = arg;
        const p = ParsePackageName(str);
        //if we do add xd, then get the latest version of xd.
        if (p.PackageVersion === "latest") {
          try {
            const f = await ResolvePackageFromLPMJSON(p.FullPackageName);
            if (f) {
              str = p.FullPackageName += "@" + f?.Parsed.PackageVersion;
            }
          } catch (err) {
            logreport.error(err);
          }
        }
        if (Options.import) {
          str += " " + "import";
        }
        if (Options.traverseImports) {
          str += " " + "traverse-imports";
        }
        Packages.push(str);
      } else {
        PackageManagerFlags.push(arg);
      }
    }
    await AddPackagesToLocalPackageJSON(
      targetWorkingDirectory,
      Packages,
      Options.dev
        ? "devDependencies"
        : Options.optional
        ? "optionalDependencies"
        : Options.peer
        ? "peerDependencies"
        : "dependencies"
    );
    const { RequiresInstall, RequiresNode_Modules_Injection } =
      await GenerateLockFileAtCwd(targetWorkingDirectory, Options);
    await AddFilesFromLockData(
      Options.packageManager,
      Options.showPmLogs,
      targetWorkingDirectory,
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
      .option(
        "--lock-version [boolean]",
        "If package@^1.4.5 is to be installed and package@1.4.6 exists, 1.4.6 will be selected by default. No version bump will force current installation to use @1.4.5. Done by tricking the LOCK file and have to package installed as @!1.4.5, but package.json will still be @^1.4.5, any other installations will resolve to @^1.4.5"
      )
      .action(async (packages, options) => {
        await this.Add(packages, options);
      })
      .command("lock!")
      .description("Generates a lock file at the current directory")
      .action(async () => {
        await GenerateLockFileAtCwd(process.cwd());
      });
  }
}
