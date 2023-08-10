import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import logreport from "./logreport.js";
import pluralize from "pluralize";
import { BackUpLPMPackagesJSON } from "../commands/backup.js";
import {
  GetHighestVersion,
  IParsedPackageNameResults,
  ParsePackageName,
  ReadPackageJSON,
  SemVersionSymbol,
} from "./PackageReader.js";
import LogTree from "console-log-tree";
import enqpkg from "enquirer";
import { getcommand } from "../lpm.js";
const { prompt } = enqpkg;

/**
 * Default lpm directory path
 */
const LPM_DIR = path.join(os.homedir(), ".local-package-manager");

interface ITempFolderObject {
  path: string;
  done: () => void;
}
/**
 * Creates an empty folder within lpm dir
 */
export async function CreateTemporaryFolder(): Promise<ITempFolderObject> {
  const id = crypto.randomBytes(16).toString("hex");
  const p = path.join(os.tmpdir(), "lpm-" + id);
  fs.mkdirSync(p, { recursive: true });
  return {
    path: p,
    done: () => {
      fs.rmSync(p, { recursive: true, force: true });
    },
  };
}

/**
 * Creates LPM package directory based off the package name, removes it if it previously existed then adds new
 */
export async function CreateLPMPackageDirectory(
  PackageName: string
): Promise<string> {
  const dir = path.join(await GetLPMPackagesDirectory(), PackageName);
  try {
    const exists = fs.existsSync(dir);
    if (exists) {
      fs.rmSync(dir, { recursive: true });
    }
  } catch (err) {
    logreport.error(err);
  }
  await fs.promises
    .mkdir(dir, {
      recursive: true,
    })
    .then(() => {
      fs.promises.mkdir(path.join(dir, "pkg")).catch((err) => {
        logreport.error(err);
      });
    })
    .catch((err) => {
      logreport.error(err);
    });
  return dir;
}

/**
 * Remove from lpm packages directory
 */
export async function RemoveLPMPackageDirectory(
  PackageName: string
): Promise<boolean> {
  const dir = path.join(await GetLPMPackagesDirectory(), PackageName);
  try {
    const exists = fs.existsSync(dir);
    if (exists) {
      fs.rmSync(dir, { recursive: true });
      return true;
    }
  } catch (err) {
    logreport.error(err);
  }
  return false;
}

/**
 * Get the LPM packages directory.
 */
export async function GetLPMPackagesDirectory(): Promise<string> {
  const d = await GetLPMDirectory().catch((e) => {
    logreport.error(e);
  });
  const LPM_PACKAGES_DIR = path.join(d as string, "packages");
  try {
    const LPM_PACKAGES_DIR_EXISTS = fs.existsSync(LPM_PACKAGES_DIR);
    if (!LPM_PACKAGES_DIR_EXISTS) {
      await fs.promises
        .mkdir(LPM_PACKAGES_DIR, { recursive: true })
        .catch((e) => {
          logreport.error(e);
        });
    }
  } catch (e) {
    logreport.error(e);
  }
  return LPM_PACKAGES_DIR;
}

/**
 * Gets the LPM directory
 */
export async function GetLPMDirectory(): Promise<string> {
  try {
    const LPM_DIRExists = fs.existsSync(LPM_DIR);
    if (!LPM_DIRExists) {
      await fs.promises.mkdir(LPM_DIR, { recursive: true }).catch((e) => {
        logreport.error(e);
      });
    }
  } catch (e) {
    logreport.error(e);
  }
  return LPM_DIR;
}

/**
 * Returns the path of the LPM Packages JSON file, Creates it if it doesn't exist.
 */
export async function GetLPMPackagesJSON(): Promise<string> {
  const PackagesJSONPath = path.join(await GetLPMDirectory(), "pkgs.json");
  try {
    const LPM_PACKAGES_JSON_Exists = fs.existsSync(PackagesJSONPath);
    if (!LPM_PACKAGES_JSON_Exists) {
      const default_data: ILPMPackagesJSON = {
        packages: {},
        version_tree: {},
      };
      await fs.promises
        .writeFile(PackagesJSONPath, JSON.stringify(default_data), "utf8")
        .catch((e) => {
          logreport.error(e);
        });
    }
  } catch (e) {
    logreport.error(e);
  }
  return PackagesJSONPath;
}

/**
 * Gets the published version from a directory
 */
export async function ResolvePackageFromLPMJSONFromDirectory(
  Directory: string,
  useReadLPM?: ILPMPackagesJSON,
  keepCurrentVersion?: boolean
): Promise<
  | { Package: ILPMPackagesJSON_Package; Parsed: IParsedPackageNameResults }
  | undefined
> {
  const PackageJSON = await ReadPackageJSON(Directory);
  if (!PackageJSON.success || typeof PackageJSON.result === "string") {
    return undefined;
  }
  if (!PackageJSON.result.name) {
    return undefined;
  }
  if (!PackageJSON.result.version) {
    return undefined;
  }
  return await ResolvePackageFromLPMJSON(
    PackageJSON.result.name + "@" + PackageJSON.result.version,
    useReadLPM,
    keepCurrentVersion
  );
}

/**
 * Resolves the package based off its name, checks in the version tree first then within the packages dictionary.
 * @param keepCurrentVersion if a version like @^1.4.5 is a passed and 1.4.6 exists, it will use 1.4.6, to only use 1.4.5, pass this argument.
 */
export async function ResolvePackageFromLPMJSON(
  PackageName: string,
  useReadLPM?: ILPMPackagesJSON,
  keepCurrentVersion?: boolean
): Promise<
  | { Package: ILPMPackagesJSON_Package; Parsed: IParsedPackageNameResults }
  | undefined
> {
  const LPMPackagesJSON = useReadLPM || (await ReadLPMPackagesJSON());
  let Parsed = ParsePackageName(PackageName);
  const INFO = LPMPackagesJSON.version_tree[Parsed.FullPackageName];
  if (!INFO) {
    logreport.warn(
      `"${PackageName}" => "${Parsed.FullPackageName}" was not found in the version tree.`
    );
    return undefined;
  }

  let HighestVersion: string | null;
  if (keepCurrentVersion) {
    HighestVersion = Parsed.PackageVersion;
  } else {
    HighestVersion = await GetHighestVersion(INFO, Parsed.VersionWithSymbol);
  }

  if (!HighestVersion) {
    logreport.warn(
      `"${PackageName}" => "${Parsed.FullPackageName}" Could not resolve latest version from version tree.`
    );
    return undefined;
  }
  //If the currently parsed version is not the highest version, the change parse to use higher version.
  if (Parsed.PackageVersion !== HighestVersion) {
    Parsed = ParsePackageName(
      `${Parsed.FullPackageName}@${Parsed.SemVersionSymbol}${HighestVersion}`
    );
  }
  const TargetPackage =
    LPMPackagesJSON.packages[
      Parsed.FullPackageName + "@" + Parsed.PackageVersion
    ];
  if (!TargetPackage) {
    return;
  }
  return { Package: TargetPackage, Parsed };
}

/**
 * Store mthe LPMPackagesJSON in memory so the JSON file is consistent, preventing race conditions.
 */
let LPMPackagesJSON_Memory: ILPMPackagesJSON | undefined;
const CorruptedGlobalRegistryJSONFileWarn = `Possibly corrupted global registry file. You can revert to a previous backed up version or manually try to fix the JSON file if you know what you're doing!\n\nRun 'lpm backup revert' to get to the backup wizard.\nRun 'lpm open json' to open json file.`;
/**
 * Reads the LPM Packages json file, if it doesn't exists then it will create it.
 */
export async function ReadLPMPackagesJSON(): Promise<ILPMPackagesJSON> {
  if (LPMPackagesJSON_Memory !== undefined) {
    return LPMPackagesJSON_Memory;
  }
  try {
    const LPMPackagesJSON = await GetLPMPackagesJSON();
    const Data: ILPMPackagesJSON = JSON.parse(
      fs.readFileSync(LPMPackagesJSON, "utf8")
    );
    if (!Data.packages) {
      logreport.error(CorruptedGlobalRegistryJSONFileWarn);
    }
    LPMPackagesJSON_Memory = Data;
    return Data;
  } catch (e) {
    logreport.error(`${e} => ` + CorruptedGlobalRegistryJSONFileWarn);
  }
  LPMPackagesJSON_Memory = {} as ILPMPackagesJSON;
  return LPMPackagesJSON_Memory;
}

/**
 * Writes the LPM Packages json file, if it doesn't exists then it will create it.
 */
export async function WriteLPMPackagesJSON(
  Data: string | ILPMPackagesJSON,
  options?: BufferEncoding
): Promise<boolean> {
  logreport.assert(
    Data !== undefined,
    "Did not get any data to write to LPM Packages JSON."
  );
  if (typeof Data === "object") {
    Data = JSON.stringify(Data, null, 1);
  }
  let wrote = false;
  try {
    await BackUpLPMPackagesJSON();
    fs.writeFileSync(
      await GetLPMPackagesJSON(),
      Data,
      options || { encoding: "utf8" }
    );
    wrote = true;
  } catch (e) {
    logreport.warn(e);
    wrote = false;
  }
  return wrote;
}

/**
 * Different possible types of installations.
 */
export type ILPMPackagesJSON_Package_installations_installtypes =
  | "default"
  | "import";

/**
 * Data about an installed package. used within published package -> installation -> installation & packages lock pkgs -> package.
 */
export type ILPMPackagesJSON_Package_installation = {
  path: string;
  install_type: ILPMPackagesJSON_Package_installations_installtypes;
  sem_ver_symbol: SemVersionSymbol;
  dependency_scope: dependency_scope;
  traverse_imports: boolean;
};

/**
 * Information about a published package inside the pkgs json.
 */
export type ILPMPackagesJSON_Package = {
  resolve: string;
  installations: ILPMPackagesJSON_Package_installation[];
  publish_sig: string;
  publish_directory: string;
  requires_import?: boolean;
};

/**
 * The read interface of the LPM pkgs file.
 */
export interface ILPMPackagesJSON {
  packages: { [key: string]: ILPMPackagesJSON_Package };
  version_tree: { [key: string]: string[] | undefined };
}

/**
 * Adds the given packaes to the lpm pkgs file. Handling duplications etc.
 */
export async function AddPackagesToLPMJSON(
  Packages: {
    name: string;
    version: string;
    resolve: string;
    publish_signature: string;
    publish_directory: string;
    requires_import?: boolean;
  }[]
): Promise<boolean> {
  logreport.assert(typeof Packages === "object", "Invalid Packages passed.");
  try {
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    for (const pkg of Packages) {
      const Parsed = ParsePackageName(pkg.name, pkg.version);
      const ExistingPkgData = LPMPackagesJSON.packages[Parsed.FullResolvedName];
      const NewData: ILPMPackagesJSON_Package = {
        resolve: pkg.resolve,
        installations: (ExistingPkgData && ExistingPkgData.installations) || [],
        publish_sig: pkg.publish_signature,
        requires_import: pkg.requires_import,
        publish_directory: pkg.publish_directory,
      };
      LPMPackagesJSON.version_tree[Parsed.FullPackageName] = [
        ...new Set([
          ...(LPMPackagesJSON.version_tree[Parsed.FullPackageName] || []),
          pkg.version,
        ]),
      ];
      LPMPackagesJSON.packages[Parsed.FullResolvedName] = NewData;
    }
    const wrote = await WriteLPMPackagesJSON(LPMPackagesJSON);
    if (!wrote) {
      logreport("Failed to write to LPM Packages.", "error");
    }
  } catch (e) {
    logreport.error(e);
  }
  return true;
}

/**
 * Removes the packages from the lpm pkgs json file. also removes from version tree.
 */
export async function RemovePackagesFromLPMJSON(
  Packages: { name: string; version: string }[],
  promptVerifyPackagesWithInstalls?: boolean
): Promise<boolean> {
  logreport.assert(typeof Packages === "object", "Invalid Packages passed.");
  try {
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    for (const pkg of Packages) {
      const ParsedInfo = ParsePackageName(pkg.name, pkg.version);
      const PublishInfo = await ResolvePackageFromLPMJSON(
        ParsedInfo.FullResolvedName,
        LPMPackagesJSON
      );
      if (PublishInfo) {
        if (
          PublishInfo.Package.installations.length > 0 &&
          promptVerifyPackagesWithInstalls
        ) {
          await prompt<{ verify: "exit" | "upgrade" | "unpublish" }>({
            name: "verify",
            type: "select",
            choices: [
              { name: "upgrade", message: "Interactive upgrade" },
              { name: "unpublish", message: "Force unpublish" },
              { name: "exit", message: "Exit" },
            ],
            message: `${PublishInfo.Parsed.FullResolvedName} is installed in ${
              PublishInfo.Package.installations.length
            } ${pluralize(
              "directories",
              PublishInfo.Package.installations.length
            )}. Are you sure you want to unpublish?\n\n${PublishInfo.Package.installations
              .map((x) => x.path)
              .join("\n")}`,
          })
            .then(async (res) => {
              if (res.verify === "exit") {
                process.exit(1);
              } else if (res.verify === "upgrade") {
                const UpgradeCommand = await getcommand("upgrade");
                for (const i of PublishInfo.Package.installations) {
                  await UpgradeCommand.Upgrade(
                    PublishInfo.Parsed.FullPackageName,
                    i.path
                  );
                }
                return await RemovePackagesFromLPMJSON(
                  Packages,
                  promptVerifyPackagesWithInstalls
                );
              } else {
                process.exit();
              }
            })
            .catch((err) => {
              process.exit();
              logreport.error(err);
              process.exit(1);
            });
        }
        delete LPMPackagesJSON.packages[ParsedInfo.FullResolvedName];
        const inVersion =
          LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName];
        if (inVersion) {
          const rmv = inVersion.filter((x) => x !== ParsedInfo.PackageVersion);
          if (rmv.length === 0) {
            LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName] =
              undefined;
          } else {
            LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName] = rmv;
          }
        }
      } else {
        logreport(
          `${ParsedInfo.FullResolvedName} is not published.`,
          "warn",
          true
        );
      }
      /*
       */
    }
    const wrote = WriteLPMPackagesJSON(LPMPackagesJSON);
    if (!wrote) {
      logreport("Failed to write to LPM Packages.", "error");
    }
  } catch (e) {
    logreport.error(e);
  }
  return true;
}

/**
 * Interface for adding an installation to a published package.
 */
export interface IAddInstallationsToGlobalPackage_Package {
  packageName: string;
  installInfo: Omit<ILPMPackagesJSON_Package_installation, "sem_ver_symbol">;
}
/**
 * Adds the packages as installations of the the target package, handling duplications etc.
 * If `@latest` is provided as the version of a target package, it will fetch the latest version of the package and use that.
 */
export async function AddInstallationsToGlobalPackage(
  Packages: IAddInstallationsToGlobalPackage_Package[]
) {
  const LPMPackagesJSON = await ReadLPMPackagesJSON();
  const LinkedUpdateInfo: string[] = [];
  for (const Package of Packages) {
    let ParsedInfo = ParsePackageName(Package.packageName);
    if (ParsedInfo.PackageVersion === "latest") {
      const PublishedVersions =
        LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName];
      if (!PublishedVersions) {
        logreport.error(
          `${ParsedInfo.FullResolvedName} could not resolve a version from @latest. Make sure the package is published.`
        );
        process.exit(1);
      }

      const HighestVersion = await GetHighestVersion(PublishedVersions);
      if (HighestVersion === null) {
        logreport.error(
          `${ParsedInfo.FullResolvedName} could not resolve a version from @latest. The package seemed to be published incorrectly.`
        );
        process.exit(1);
      }
      ParsedInfo = ParsePackageName(
        ParsedInfo.FullPackageName,
        ParsedInfo.SemVersionSymbol + HighestVersion
      );
    }
    const TargetPackage = LPMPackagesJSON.packages[ParsedInfo.FullResolvedName];
    if (!TargetPackage) {
      logreport.error(
        `${ParsedInfo.FullResolvedName} was not found in the local package registry.`
      );
    }
    let OldInstallationData = TargetPackage.installations;
    if (!OldInstallationData) {
      logreport(
        `No Installations was found on package ${ParsedInfo.FullResolvedName}. Check backups to find previous installations of this package.`,
        "warn"
      );
      OldInstallationData = [];
    }
    const PublishedVersionsOfPkg =
      LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName];

    //check if it was installed previously with a different version. if so, remove it.
    if (PublishedVersionsOfPkg) {
      for (const version of PublishedVersionsOfPkg) {
        if (version === ParsedInfo.PackageVersion) {
          continue;
        }
        const tpub =
          LPMPackagesJSON.packages[ParsedInfo.FullPackageName + "@" + version];
        if (tpub) {
          LPMPackagesJSON.packages[
            ParsedInfo.FullPackageName + "@" + version
          ].installations = tpub.installations.filter(
            (x) => x.path !== Package.installInfo.path
          );
        }
      }
    }
    const AddInstallationData: ILPMPackagesJSON_Package_installation = {
      install_type: Package.installInfo.install_type,
      path: Package.installInfo.path,
      sem_ver_symbol: ParsedInfo.SemVersionSymbol,
      dependency_scope: Package.installInfo.dependency_scope,
      traverse_imports: (Package.installInfo.traverse_imports ||
        undefined) as boolean, //if traverse_imports is false, save it as undefined.
    };
    LinkedUpdateInfo.push(
      `${ParsedInfo.FullSemVerResolvedName} as ${
        Package.installInfo.install_type
      } ${pluralize(Package.installInfo.dependency_scope, 1)}`
    );
    // filter so paths are unique and not duplicated
    const t = [...OldInstallationData, ...[AddInstallationData]];
    const paths = t.map(({ path }) => path);
    TargetPackage.installations = t.filter(
      ({ path }, index) => !paths.includes(path, index + 1)
    );
  }
  console.log(
    LogTree.parse(
      LinkedUpdateInfo.map((x) => {
        return { name: x };
      })
    )
  );
  // logreport(`\n\t${LinkedUpdateInfo.join("\n\t")}`, "log", true);
  await WriteLPMPackagesJSON(LPMPackagesJSON);
}

/**
 * Removes the given installations from the given packages.
 */
export async function RemoveInstallationsFromGlobalPackage(
  packageNames: string[],
  Installations: string[]
) {
  const LPMPackagesJSON = await ReadLPMPackagesJSON();
  packageNames.forEach((packageName) => {
    const TargetPackage = LPMPackagesJSON.packages[packageName];
    if (!TargetPackage) {
      logreport.error(
        `${packageName} was not found in the local package registry.`,
        true
      );
    }
    TargetPackage.installations = TargetPackage.installations.filter((e) => {
      const f = Installations.indexOf(e.path);
      if (f !== -1) {
        return false;
      }
    });
  });
  await WriteLPMPackagesJSON(LPMPackagesJSON);
}

/**
 * Possible dependency scopes a package can have
 */
export type dependency_scope =
  | "peerDependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "dependencies";

/**
 * Refers to a package inside a lock file.pkgs.
 */
export type LOCKFILEPKG = Omit<ILPMPackagesJSON_Package_installation, "path"> &
  Pick<ILPMPackagesJSON_Package, "publish_sig" | "requires_import"> & {
    resolve: string;
  };

/**
 * The read version of a LOCK file.
 */
interface LOCKFILE {
  pkgs: { [key: string]: LOCKFILEPKG };
}

/**
 * Checks for a `lpm.lock` file in the given directory, if no directory is provided, will default to cwd.
 */
export async function ReadLockFileFromCwd(
  cwd?: string,
  warnNoExist?: boolean,
  noLogs?: boolean
): Promise<LOCKFILE> {
  cwd = cwd || process.cwd();
  try {
    if (!fs.existsSync(path.join(cwd, "lpm.lock"))) {
      if (noLogs) {
        return undefined as unknown as LOCKFILE;
      }
      if (warnNoExist) {
        logreport.warn(`No lock file exists in ${path.resolve(cwd)}.`);
        return undefined as unknown as LOCKFILE;
      } else {
        logreport.error(`No lock file exists in ${path.resolve(cwd)}.`);
      }
    }
    return JSON.parse(fs.readFileSync(path.join(cwd, "lpm.lock"), "utf8"));
  } catch (e) {
    logreport.error(
      `Could not read lock file ${path.resolve(cwd, "lpm.lock")}.`
    );
  }
  return {} as LOCKFILE;
}

/**
 * Creates a lock file at the given working directory.
 */
export async function AddLockFileToCwd(cwd?: string, data?: unknown) {
  cwd = cwd || process.cwd();
  try {
    if (!fs.existsSync(path.join(cwd, "lpm.lock"))) {
      fs.writeFileSync(
        path.join(cwd, "lpm.lock"),
        JSON.stringify(data || {}, undefined, 2)
      );
    } else {
      if (data) {
        fs.writeFileSync(
          path.join(cwd, "lpm.lock"),
          JSON.stringify(data || {}, undefined, 2)
        );
      }
    }
  } catch (e) {
    logreport.error("Could not create lock file " + cwd);
  }
}

/**
 * Gets the package info by the name from the LOCK file.
 */
export async function GetPackageFromLockFileByName(
  Name: string,
  cwd: string,
  useLockFile?: LOCKFILE
): Promise<LOCKFILEPKG | undefined> {
  const LOCK = useLockFile || (await ReadLockFileFromCwd(cwd));
  for (const x in LOCK.pkgs) {
    const parsed = ParsePackageName(x);
    if (
      parsed.FullPackageName === Name ||
      parsed.FullResolvedName === Name ||
      parsed.FullSemVerResolvedName === Name
    ) {
      return LOCK.pkgs[x];
    }
  }
}

/**
 * When generating LOCK file, files that should be updated,install,uninstalled are returned as this type.
 */
export type RequireFileChangeGenerateObj = LOCKFILEPKG & {
  name: string;
};
/**
 * Returns packages that should be installed/uninstall based on the new lock file.
 * /REMOVE: If no publish sig was found then it will not include as must install / must uninstall since it will be considered fresh.
 */
export async function GenerateLockFileAtCwd(cwd?: string): Promise<{
  RequiresInstall: RequireFileChangeGenerateObj[];
  // RequiresUninstall: RequireFileChangeGenerateObj[];
  RequiresNode_Modules_Injection: RequireFileChangeGenerateObj[];
}> {
  let RequiresInstall: RequireFileChangeGenerateObj[] = [];
  // const RequiresUninstall: RequireFileChangeGenerateObj[] = [];
  let RequiresNode_Modules_Injection: RequireFileChangeGenerateObj[] = [];
  cwd = cwd || process.cwd();
  await AddLockFileToCwd(cwd);
  try {
    const PreviousLockfileData = await ReadLockFileFromCwd(cwd, true, true);
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const LOCK: LOCKFILE = {
      pkgs: {},
    };
    for (const Package in LPMPackagesJSON.packages) {
      const PreviousInLock =
        (PreviousLockfileData.pkgs && PreviousLockfileData.pkgs[Package]) || {};
      const PackageData = LPMPackagesJSON.packages[Package];
      PackageData.installations.forEach(async (installation) => {
        if (installation.path === cwd) {
          if (!LOCK.pkgs[Package]) {
            // new lock data, and if anything specific needs to be changed push to desired array, inject/install
            const f: RequireFileChangeGenerateObj = {
              name: Package,
              resolve: PackageData.resolve,
              publish_sig: PackageData.publish_sig,
              requires_import: PackageData.requires_import,
              install_type: installation.install_type,
              sem_ver_symbol: installation.sem_ver_symbol,
              traverse_imports: installation.traverse_imports,
              dependency_scope: installation.dependency_scope,
            };
            // the install_type changed. e.g from default => import
            if (PreviousInLock.install_type !== installation.install_type) {
              RequiresNode_Modules_Injection.push(f);
            }
            // the dependency_scope change. e.g from dependencies => devDependencies
            if (
              PreviousInLock.dependency_scope !== installation.dependency_scope
            ) {
              RequiresInstall.push(f);
            }
            //a new publish was made but installed version has old/uknown signature. so request update
            if (PackageData.publish_sig !== PreviousInLock.publish_sig) {
              if (PreviousInLock.publish_sig !== undefined) {
                const lockpsigsplit = PreviousInLock.publish_sig.split("-");
                const pubsigsplit = PackageData.publish_sig.split("-");
                const IS_SAME_PACKAGE_JSON =
                  lockpsigsplit[1] === pubsigsplit[1];
                if (IS_SAME_PACKAGE_JSON) {
                  RequiresNode_Modules_Injection.push(f); //If the package.json remains the same, just inject the module into node_modules instead of updating with package manager.
                } else {
                  RequiresInstall.push(f);
                }
              } else {
                RequiresInstall.push(f);
              }
            }
            LOCK.pkgs[Package] = f;
          }
        }
      });
    }
    await AddLockFileToCwd(cwd, LOCK);
  } catch (e) {
    logreport.error("Failed to generate lock file " + e);
  }

  function FilterRequireDuplicates(Target: RequireFileChangeGenerateObj[]) {
    const t = [...Target];
    const _requiresInjection = t.map(({ name, resolve }) => name + resolve);
    return (Target = t.filter(
      ({ name, resolve }, index) =>
        !_requiresInjection.includes(name + resolve, index + 1)
    ));
  }

  //remove duplications.
  RequiresNode_Modules_Injection = FilterRequireDuplicates(
    RequiresNode_Modules_Injection
  );
  RequiresInstall = FilterRequireDuplicates(RequiresInstall);

  //Anything that requires install, remove if from requires injection.
  RequiresNode_Modules_Injection = RequiresNode_Modules_Injection.filter(
    (x) => {
      return (
        RequiresInstall.findIndex(
          (tx) => tx.name === x.name && tx.resolve === x.resolve
        ) === -1
      );
    }
  );

  return {
    RequiresInstall: RequiresInstall,
    RequiresNode_Modules_Injection: RequiresNode_Modules_Injection,
  };
}
