import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import pluralize from "pluralize";
import { BackUpLPMPackagesJSON } from "../commands/backup.js";
import {
  GetHighestVersion,
  IParsedPackageNameResults,
  ParsePackageName,
  ReadPackageJSON,
  SemVersionSymbol,
} from "./PackageReader.js";
import enqpkg from "enquirer";
import { getcommand } from "../lpm.js";
import {
  AddFilesFromLockData,
  AddOptions,
  GetPreferredPackageManager,
} from "../commands/add.js";
import { Console, LogSteps } from "@mekstuff/logreport";
import LogOutdatedPackagesAtCwd from "./packageinfo.js";
import { SUPPORTED_PACKAGE_MANAGERS } from "./CONSTANTS.js";
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
    Console.error(err);
  }
  await fs.promises
    .mkdir(dir, {
      recursive: true,
    })
    .then(() => {
      fs.promises.mkdir(path.join(dir, "pkg")).catch((err) => {
        Console.error(err);
      });
    })
    .catch((err) => {
      Console.error(err);
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
    Console.error(err);
  }
  return false;
}

/**
 * Get the LPM packages directory.
 */
export async function GetLPMPackagesDirectory(): Promise<string> {
  const d = await GetLPMDirectory().catch((e) => {
    Console.error(e);
  });
  const LPM_PACKAGES_DIR = path.join(d as string, "packages");
  try {
    const LPM_PACKAGES_DIR_EXISTS = fs.existsSync(LPM_PACKAGES_DIR);
    if (!LPM_PACKAGES_DIR_EXISTS) {
      await fs.promises
        .mkdir(LPM_PACKAGES_DIR, { recursive: true })
        .catch((e) => {
          Console.error(e);
        });
    }
  } catch (e) {
    Console.error(e);
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
        Console.error(e);
      });
    }
  } catch (e) {
    Console.error(e);
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
          Console.error(e);
        });
    }
  } catch (e) {
    Console.error(e);
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
    Console.warn(
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
    Console.warn(
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

let USE_LPM_PACKAGES_JSON_MEMORY = true;
/**
 * By default, once lpm packages json is read, it will not read the file again and use the object in memory, if
 * something like a watcher is being used/or the lpm packages json file can be updated elsewhere before this command
 * finishes executing, set UseMemory to false so it always read for the new data in the file system
 */
export function SetUseLPMPackagesJSONMemory(state: boolean) {
  USE_LPM_PACKAGES_JSON_MEMORY = state;
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
  if (LPMPackagesJSON_Memory !== undefined && USE_LPM_PACKAGES_JSON_MEMORY) {
    return LPMPackagesJSON_Memory;
  }
  try {
    const LPMPackagesJSON = await GetLPMPackagesJSON();
    const Data: ILPMPackagesJSON = JSON.parse(
      fs.readFileSync(LPMPackagesJSON, "utf8")
    );
    if (!Data.packages) {
      Console.error(CorruptedGlobalRegistryJSONFileWarn);
    }
    LPMPackagesJSON_Memory = Data;
    return Data;
  } catch (e) {
    Console.error(`${e} => ` + CorruptedGlobalRegistryJSONFileWarn);
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
  Console.assert(
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
    Console.warn(e);
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
  // install_type: ILPMPackagesJSON_Package_installations_installtypes;
  // sem_ver_symbol: SemVersionSymbol;
  // dependency_scope: dependency_scope;
  // traverse_imports: boolean;
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
  version_tree: { [key: string]: string[] };
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
  Console.assert(typeof Packages === "object", "Invalid Packages passed.");
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
      Console.error("Failed to write to LPM Packages.");
    }
  } catch (e) {
    Console.error(e);
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
  Console.assert(typeof Packages === "object", "Invalid Packages passed.");
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
                    [PublishInfo.Parsed.FullPackageName],
                    i.path,
                    {
                      currentDisabled: true,
                    }
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
              Console.error(err);
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
              undefined as unknown as string[];
          } else {
            LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName] = rmv;
          }
        }
      } else {
        Console.warn(`${ParsedInfo.FullResolvedName} is not published.`);
      }
      /*
       */
    }
    const wrote = WriteLPMPackagesJSON(LPMPackagesJSON);
    if (!wrote) {
      Console.error("Failed to write to LPM Packages.");
    }
  } catch (e) {
    Console.error(e);
  }
  return true;
}

/**
 * Interface for adding an installation to a published package.
 */
export interface IAddInstallationsToGlobalPackage_Package {
  packageName: string;
  installInfo: { path: string };
  // installInfo: Omit<ILPMPackagesJSON_Package_installation, "sem_ver_symbol">;
}
/**
 * Adds the packages as installations of the the target package, handling duplications etc.
 * If `@latest` is provided as the version of a target package, it will fetch the latest version of the package and use that.
 */
export async function AddInstallationsToGlobalPackage(
  Packages: IAddInstallationsToGlobalPackage_Package[]
) {
  const LPMPackagesJSON = await ReadLPMPackagesJSON();
  for (const Package of Packages) {
    let ParsedInfo = ParsePackageName(Package.packageName);
    if (ParsedInfo.PackageVersion === "latest") {
      const PublishedVersions =
        LPMPackagesJSON.version_tree[ParsedInfo.FullPackageName];
      if (!PublishedVersions) {
        Console.error(
          `${ParsedInfo.FullResolvedName} could not resolve a version from @latest. Make sure the package is published.`
        );
        process.exit(1);
      }

      const HighestVersion = await GetHighestVersion(PublishedVersions);
      if (HighestVersion === null) {
        Console.error(
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
      Console.error(
        `${ParsedInfo.FullResolvedName} was not found in the local package registry.`
      );
    }
    let OldInstallationData = TargetPackage.installations;
    if (!OldInstallationData) {
      Console.warn(
        `No Installations was found on package ${ParsedInfo.FullResolvedName}. Check backups to find previous installations of this package.`
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
      path: Package.installInfo.path,
    };
    // filter so paths are unique and not duplicated
    const t = [...OldInstallationData, ...[AddInstallationData]];
    const paths = t.map(({ path }) => path);
    TargetPackage.installations = t.filter(
      ({ path }, index) => !paths.includes(path, index + 1)
    );
  }
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
      Console.error(
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
// export type LOCKFILEPKG = Omit<ILPMPackagesJSON_Package_installation, "path"> &
//   Pick<ILPMPackagesJSON_Package, "publish_sig" | "requires_import"> & {
//     resolve: string;
//   };
export type LOCKFILEPKG = {
  install_type: ILPMPackagesJSON_Package_installations_installtypes;
  sem_ver_symbol: SemVersionSymbol;
  dependency_scope: dependency_scope;
  traverse_imports: boolean;
  resolve: string;
  publish_sig: string;
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
        Console.warn(`No lock file exists in ${path.resolve(cwd)}.`);
        return undefined as unknown as LOCKFILE;
      } else {
        Console.error(`No lock file exists in ${path.resolve(cwd)}.`);
      }
    }
    return JSON.parse(fs.readFileSync(path.join(cwd, "lpm.lock"), "utf8"));
  } catch (e) {
    Console.error(`Could not read lock file ${path.resolve(cwd, "lpm.lock")}.`);
  }
  return {} as LOCKFILE;
}

/**
 * Creates a lock file at the given working directory.
 */
export async function AddLockFileToCwd(cwd?: string, data?: LOCKFILE) {
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
    Console.error("Could not create lock file " + cwd);
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
 * Runs `GenerateLockFileAtCwd` then `AddFilesFromLockData`
 */
export async function GenerateLockAndAddFiles(
  cwd: string,
  currentAddOptions?: AddOptions,
  packageManager?: SUPPORTED_PACKAGE_MANAGERS,
  showPmLogs?: boolean
) {
  const Stepper = LogSteps(["Generating LOCK", "Adding Files"], true);
  Stepper.step();
  const { RequiresInstall, RequiresNode_Modules_Injection } =
    await GenerateLockFileAtCwd(cwd, currentAddOptions);
  Stepper.step();
  await AddFilesFromLockData(
    packageManager || (await GetPreferredPackageManager(cwd)),
    showPmLogs,
    cwd,
    RequiresInstall,
    RequiresNode_Modules_Injection
  );
  Stepper.step();
}
/**
 * When generating LOCK file, files that should be updated,install,uninstalled are returned as this type.
 */
export type RequireFileChangeGenerateObj = LOCKFILEPKG & {
  name: string;
  requires_import?: boolean;
};
/**
 * Returns packages that should be installed/uninstall based on the new lock file.
 * /REMOVE: If no publish sig was found then it will not include as must install / must uninstall since it will be considered fresh.
 */
export async function GenerateLockFileAtCwd(
  cwd?: string,
  currentAddOptions?: AddOptions
): Promise<{
  RequiresInstall: RequireFileChangeGenerateObj[];
  // RequiresUninstall: RequireFileChangeGenerateObj[];
  RequiresNode_Modules_Injection: RequireFileChangeGenerateObj[];
}> {
  let RequiresInstall: RequireFileChangeGenerateObj[] = [];
  // const RequiresUninstall: RequireFileChangeGenerateObj[] = [];
  let RequiresNode_Modules_Injection: RequireFileChangeGenerateObj[] = [];
  cwd = cwd || process.cwd();

  const GeneratingLockProgress = Console.progress.bar();
  GeneratingLockProgress(5, "Generating LOCK");

  const PackageJSON = await ReadPackageJSON(cwd);
  if (!PackageJSON.success || typeof PackageJSON.result === "string") {
    Console.error(PackageJSON.result);
    process.exit(1);
  }

  if (!PackageJSON.result.local) {
    return {
      RequiresInstall,
      RequiresNode_Modules_Injection,
    };
  }
  const LOCK: LOCKFILE = {
    pkgs: {},
  };
  const _OLDLOCK = await ReadLockFileFromCwd(cwd, undefined, true);
  const HAD_OLD_LOCK = _OLDLOCK ? true : false;
  const OLDLOCK = _OLDLOCK || { pkgs: {} };

  const inScope = async (
    x: { [key: string]: string | string[] } | undefined,
    scope: dependency_scope
  ) => {
    if (!x) {
      return;
    }
    for (const n in x) {
      const v = x[n];
      const t: Partial<{ name: string; version: string; options: string[] }> = {
        name: n,
      };
      if (typeof v === "string") {
        t.version = v;
      } else {
        t.version = v[0];
        t.options = v.splice(1);
      }
      if (typeof t.name !== "string") {
        Console.error(
          `No package name provided, got ${t.name} ${typeof t.name}`
        );
        process.exit(1);
      }
      if (typeof t.version !== "string") {
        Console.error(
          `Invalid package version provided, got ${
            t.version
          } ${typeof t.version}`
        );
        process.exit(1);
      }
      let Parsed = ParsePackageName(t.name + "@" + t.version);
      let MUST_USE_SEMVER_SYMBOL: SemVersionSymbol = Parsed.SemVersionSymbol; //since --lock-version forces `!`, we don't want it to persist so use this param from original semver symbol.
      if (currentAddOptions?.lockVersion) {
        MUST_USE_SEMVER_SYMBOL = Parsed.SemVersionSymbol;
        Parsed = ParsePackageName(
          Parsed.FullPackageName + "@!" + Parsed.PackageVersion
        );
      }
      const PublishedPackage = await ResolvePackageFromLPMJSON(
        Parsed.FullSemVerResolvedName
        // undefined,
        // true
      );
      if (!PublishedPackage) {
        Console.error(
          `${Parsed.FullResolvedName} is not published or could not be resolved.`
        );
        process.exit(1);
      }
      const install_type =
        (t.options && t.options.indexOf("import") !== -1 && "import") ||
        "default";

      const traverse_imports =
        (t.options && t.options.indexOf("traverse-imports") !== -1 && true) ||
        false;

      const OLDINLOCK =
        OLDLOCK.pkgs[PublishedPackage.Parsed.FullResolvedName] || {};

      const f: RequireFileChangeGenerateObj = {
        name: PublishedPackage.Parsed.FullResolvedName,
        dependency_scope: scope,
        install_type: install_type,
        publish_sig: PublishedPackage.Package.publish_sig,
        resolve: PublishedPackage.Package.resolve,
        sem_ver_symbol: MUST_USE_SEMVER_SYMBOL,
        traverse_imports: traverse_imports,
        requires_import: PublishedPackage.Package.requires_import,
      };

      //not in node_modules
      if (
        !fs.existsSync(
          path.join(
            cwd as string,
            "node_modules",
            PublishedPackage.Parsed.FullPackageName
          )
        )
      ) {
        RequiresNode_Modules_Injection.push(f);
      }

      //dependency_scope changed
      if (OLDINLOCK.dependency_scope !== scope) {
        RequiresInstall.push(f);
      }

      // install type changed
      if (OLDINLOCK.install_type !== install_type) {
        RequiresNode_Modules_Injection.push(f);
      }

      //traverse imports changed
      if (OLDINLOCK.traverse_imports !== traverse_imports) {
        RequiresInstall.push(f);
      }

      //a new publish was made but installed version has old/uknown signature. so request update
      if (PublishedPackage.Package.publish_sig !== OLDINLOCK.publish_sig) {
        if (OLDINLOCK.publish_sig !== undefined) {
          const lockpsigsplit = OLDINLOCK.publish_sig.split("-");
          const pubsigsplit = PublishedPackage.Package.publish_sig.split("-");
          const IS_SAME_PACKAGE_JSON = lockpsigsplit[1] === pubsigsplit[1];
          if (IS_SAME_PACKAGE_JSON) {
            RequiresNode_Modules_Injection.push(f); //If the package.json remains the same, just inject the module into node_modules instead of updating with package manager.
          } else {
            RequiresInstall.push(f);
          }
        } else {
          RequiresInstall.push(f);
        }
      }
      LOCK.pkgs[PublishedPackage.Parsed.FullResolvedName] = f;
    }
  };
  GeneratingLockProgress(10, "Loading dependencies");
  await inScope(PackageJSON.result.local.dependencies, "dependencies");
  GeneratingLockProgress(20, "Loading devDependencies");
  await inScope(PackageJSON.result.local.devDependencies, "devDependencies");
  GeneratingLockProgress(30, "Loading peerDependencies");
  await inScope(PackageJSON.result.local.peerDependencies, "peerDependencies");
  GeneratingLockProgress(40, "Loading optionalDependencies");
  await inScope(
    PackageJSON.result.local.optionalDependencies,
    "optionalDependencies"
  );

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

  GeneratingLockProgress(70, "Adding LOCK file to cwd.");
  await AddLockFileToCwd(cwd, LOCK);
  //updating installations globally.
  if (!HAD_OLD_LOCK) {
    Console.log(`Generating new LOCK file from scratch.`);
    const p = [];
    const lpj = await ReadLPMPackagesJSON();
    for (const x in lpj.packages) {
      if (lpj.packages[x].installations.find((x) => x.path === cwd)) {
        p.push(x);
      }
    }
    await RemoveInstallationsFromGlobalPackage(p, [cwd]);
  } else {
    for (const i in OLDLOCK.pkgs) {
      //for previously installed
      if (!LOCK.pkgs[i]) {
        //it was in previous lock but not in current lock, assumed uninstalled.
        await RemoveInstallationsFromGlobalPackage([i], [cwd]);
      }
    }
  }
  GeneratingLockProgress(90, "Storing Globally");
  for (const i in LOCK.pkgs) {
    // const v = LOCK.pkgs[i];
    await AddInstallationsToGlobalPackage([
      { packageName: i, installInfo: { path: cwd } },
    ]);
  }
  GeneratingLockProgress(100, "LOCK File Generated.");
  LogOutdatedPackagesAtCwd(cwd);
  return {
    RequiresInstall: RequiresInstall,
    RequiresNode_Modules_Injection: RequiresNode_Modules_Injection,
  };
}
