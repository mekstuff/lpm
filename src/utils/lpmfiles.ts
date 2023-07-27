import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import logreport from "./logreport.js";
import { BackUpLPMPackagesJSON } from "../commands/backup.js";
import { PackageFile, ReadPackageJSON } from "./PackageReader.js";
import chalk from "chalk";

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
  //   const dir = await GetLPM_DIRectory();
}

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

export async function GetLPMPackagesJSON(): Promise<string> {
  const PackagesJSONPath = path.join(await GetLPMDirectory(), "pkgs.json");
  try {
    const LPM_PACKAGES_JSON_Exists = fs.existsSync(PackagesJSONPath);
    if (!LPM_PACKAGES_JSON_Exists) {
      await fs.promises
        .writeFile(
          PackagesJSONPath,
          JSON.stringify({
            packages: {},
          }),
          "utf8"
        )
        .catch((e) => {
          logreport.error(e);
        });
    }
  } catch (e) {
    logreport.error(e);
  }
  return PackagesJSONPath;
}

const CorruptedGlobalRegistryJSONFileWarn = `Possibly corrupted global registry file. You can revert to a previous backed up version or manually try to fix the JSON file if you know what you're doing!\n\nRun 'lpm backup revert' to get to the backup wizard.\nRun 'lpm open json' to open json file.`;

export async function ReadLPMPackagesJSON(): Promise<ILPMPackagesJSON> {
  try {
    const LPMPackagesJSON = await GetLPMPackagesJSON();
    const Data: ILPMPackagesJSON = JSON.parse(
      fs.readFileSync(LPMPackagesJSON, "utf8")
    );
    if (!Data.packages) {
      logreport.error(CorruptedGlobalRegistryJSONFileWarn);
    }
    return Data;
  } catch (e) {
    logreport.error(`${e} => ` + CorruptedGlobalRegistryJSONFileWarn);
  }
  return {} as ILPMPackagesJSON;
}

export async function WriteLPMPackagesJSON(
  Data: string | object,
  options?: BufferEncoding
): Promise<boolean> {
  logreport.assert(
    Data !== undefined,
    "Did not get any data to write to LPM Packages JSON."
  );
  if (typeof Data === "object") {
    Data = JSON.stringify(Data, null, 2);
  }
  let wrote = false;
  try {
    await BackUpLPMPackagesJSON();
    fs.writeFileSync(
      await GetLPMPackagesJSON(),
      Data,
      options || { encoding: "utf8" }
    );
  } catch (e) {
    wrote = false;
  }
  return wrote;
}

type ILPMPackagesJSON_Package = {
  resolve: string;
  installations: string[];
  publish_sig: string;
};
interface ILPMPackagesJSON {
  packages: { [key: string]: ILPMPackagesJSON_Package };
}

function GeneratePublishSignatureCode(): string {
  return crypto.randomBytes(3).toString("hex") + ".pbshsig";
}

export async function AddPackagesToLPMJSON(
  Packages: { name: string; resolve: string }[]
): Promise<boolean> {
  logreport.assert(typeof Packages === "object", "Invalid Packages passed.");
  try {
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    Packages.forEach(async (pkg) => {
      const ExistingPkgData = LPMPackagesJSON.packages[pkg.name];
      const NewData: ILPMPackagesJSON_Package = {
        resolve: pkg.resolve,
        installations: (ExistingPkgData && ExistingPkgData.installations) || [],
        publish_sig: GeneratePublishSignatureCode(),
      };

      LPMPackagesJSON.packages[pkg.name] = NewData;
    });
    const wrote = WriteLPMPackagesJSON(LPMPackagesJSON);
    if (!wrote) {
      logreport("Failed to write to LPM Packages.", "error");
    }
  } catch (e) {
    logreport.error(e);
  }
  return true;
}

export async function RemovePackagesFromLPMJSON(
  Packages: string[]
): Promise<boolean> {
  logreport.assert(typeof Packages === "object", "Invalid Packages passed.");
  try {
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    Packages.forEach(async (pkg) => {
      if (LPMPackagesJSON.packages[pkg]) {
        delete LPMPackagesJSON.packages[pkg];
      } else {
        logreport(`${pkg} was not published.`, "warn", true);
      }
    });
    const wrote = WriteLPMPackagesJSON(LPMPackagesJSON);
    if (!wrote) {
      logreport("Failed to write to LPM Packages.", "error");
    }
  } catch (e) {
    logreport.error(e);
  }
  return true;
}
export async function AddInstallationsToGlobalPackage(
  packageNames: string[],
  Installations: string[]
) {
  const LPMPackagesJSON = await ReadLPMPackagesJSON();
  packageNames.forEach((packageName) => {
    const TargetPackage = LPMPackagesJSON.packages[packageName];
    if (!TargetPackage) {
      logreport.error(
        `${packageName} was not found in the local package registry.`
      );
    }
    let OldInstallationData = TargetPackage.installations;
    if (!OldInstallationData) {
      logreport(
        `No Installations was found on package ${packageName}. Check backups to find previous installations of this package.`,
        "warn"
      );
      OldInstallationData = [];
    }
    TargetPackage.installations = [
      ...new Set([...OldInstallationData, ...Installations]),
    ];
  });
  await WriteLPMPackagesJSON(LPMPackagesJSON);
}

export async function RemoveInstallationsToGlobalPackage(
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
      const f = Installations.indexOf(e);
      if (f !== -1) {
        return false;
      }
    });
  });
  await WriteLPMPackagesJSON(LPMPackagesJSON);
}

//LOCK
type LOCKFILEPKG = {
  resolve: string;
  publish_sig: string;
  dependencyScope?:
    | "peerDependency"
    | "devDependency"
    | "optionalDependency"
    | "dependency";
};
interface LOCKFILE {
  pkgs: { [key: string]: LOCKFILEPKG };
}

export async function ReadLockFileFromCwd(
  cwd?: string,
  warnNoExist?: boolean
): Promise<LOCKFILE> {
  cwd = cwd || ".";
  try {
    if (!fs.existsSync(path.join(cwd, "lpm.lock"))) {
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

function GetPackageDependencyScope(
  Package: string,
  TargetPackageJSON: PackageFile
): LOCKFILEPKG["dependencyScope"] {
  //dependency
  if (
    TargetPackageJSON.dependencies &&
    TargetPackageJSON.dependencies[Package]
  ) {
    return "dependency";
  }
  //devDependency
  if (
    TargetPackageJSON.devDependencies &&
    TargetPackageJSON.devDependencies[Package]
  ) {
    return "devDependency";
  }
  return "dependency";
}

export type RequireFileChangeGenerateObj = {
  name: string;
  data: ILPMPackagesJSON_Package;
};
/**
 * Returns packages that should be installed/uninstall based on the new lock file.
 * /REMOVE: If no publish sig was found then it will not include as must install / must uninstall since it will be considered fresh.
 */
export async function GenerateLockFileAtCwd(cwd?: string): Promise<{
  RequiresInstall: RequireFileChangeGenerateObj[];
  RequiresUninstall: RequireFileChangeGenerateObj[];
}> {
  const RequiresInstall: RequireFileChangeGenerateObj[] = [];
  const RequiresUninstall: RequireFileChangeGenerateObj[] = [];
  cwd = cwd || process.cwd();
  await AddLockFileToCwd(cwd);
  try {
    const PreviousLockfileData: LOCKFILE = JSON.parse(
      fs.readFileSync(path.join(cwd, "lpm.lock")).toString()
    );

    const CWDPackageJSON = await ReadPackageJSON(cwd);
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const LOCK: LOCKFILE = {
      pkgs: {},
    };
    // const bindir = path.join(cwd, "node_modules", ".bin");
    for (const Package in LPMPackagesJSON.packages) {
      const PreviousInLock =
        (PreviousLockfileData.pkgs && PreviousLockfileData.pkgs[Package]) || {};
      const PackageData = LPMPackagesJSON.packages[Package];
      PackageData.installations.forEach(async (installation) => {
        if (installation === cwd) {
          if (!LOCK.pkgs[Package]) {
            //a new publish was made but installed version has old/uknown signature. so request update
            if (
              // PreviousInLock.publish_sig !== undefined &&
              PackageData.publish_sig !== PreviousInLock.publish_sig
            ) {
              RequiresInstall.push({
                name: Package,
                data: PackageData,
              });
            }

            LOCK.pkgs[Package] = {
              resolve: PackageData.resolve,
              publish_sig: PackageData.publish_sig,
              // pm: PreviousInLock.pm || undefined,
            };

            //setting the dependency scope (dependency, devDependency, peerDependency, etc...)
            if (
              CWDPackageJSON.success &&
              CWDPackageJSON.result !== undefined &&
              typeof CWDPackageJSON.result !== "string"
            ) {
              LOCK.pkgs[Package].dependencyScope = GetPackageDependencyScope(
                Package,
                CWDPackageJSON.result
              );
            }

            //updating .bin files to use relative paths and not symlink paths.
            /* disabled since the introduction of lpx.
            try {
              const Read = await ReadPackageJSON(PackageData.resolve);
              if (!Read.success) {
                logreport.warn("No package.json file exist. => " + Read.result);
                return;
              }
              if (typeof Read.result === "string") {
                logreport.warn("something went wrong");
                return;
              }
              const UpdateBins = new Map<string, string>();
              if (Read.result.bin) {
                for (const binName in Read.result.bin) {
                  const binSource = Read.result.bin[binName];
                  UpdateBins.set(binName, binSource);
                }
              }
              if (UpdateBins.size > 0) {
                UpdateBins.forEach((binSource, binName) => {
                  // const BinFilePath = path.join(bindir, binName);

                  //for /.bin/binName.cmd
                  const BinCMDPath = path.join(bindir, binName + ".cmd");
                  if (fs.existsSync(BinCMDPath)) {
                    const Source = fs.readFileSync(BinCMDPath, "utf8");
                    //path in cwd (node_modules/...)
                    const ExecutableSourceFileInNodeModules =
                      "\\" +
                      path.relative(
                        bindir,
                        path.join("node_modules", Package, binSource)
                      );
                    //path in .lpm global directory
                    const BinSourceFileRelativeToNodeModulesBin =
                      "\\" +
                      path.relative(
                        bindir,
                        path.join(PackageData.resolve, binSource)
                      );
                    const SEARCH_NODE_EXE_IF = `"%~dp0\\node.exe"  "%~dp0${BinSourceFileRelativeToNodeModulesBin}" %*`;
                    const REPLACE_NODE_EXE_IF = `"%~dp0\\node.exe --preserve-symlinks --preserve-symlinks-main "  "%~dp0${ExecutableSourceFileInNodeModules}" %*`;
                    const SEARCH_NODE_EXE_ELSE = `node  "%~dp0${BinSourceFileRelativeToNodeModulesBin}" %*`;
                    const REPLACE_NODE_EXE_ELSE = `node --preserve-symlinks --preserve-symlinks-main  "%~dp0${ExecutableSourceFileInNodeModules}" %*`;
                    const newSource =
                      "@REM This binary file was edited by LPM.\n@REM Some node flags were added to have local dependencies binaries be executed properly.\n@REM To report any problems or get support: https://github.com/mekstuff/lpm\n\n" +
                      Source.replace(
                        SEARCH_NODE_EXE_IF,
                        REPLACE_NODE_EXE_IF
                      ).replace(SEARCH_NODE_EXE_ELSE, REPLACE_NODE_EXE_ELSE);

                    fs.writeFileSync(BinCMDPath, newSource, "utf8");
                  }
                });
              }
            } catch (err) {
              logreport.warn("Could not update .bin files => " + err);
            }
            */
          }
        }
      });
      /*
      //updating .bin files to use relative paths and not symlink paths.
      try {
        const bindir = path.join(cwd, "node_modules", ".bin");
        if (fs.existsSync(bindir)) {
          for (const pkg in LOCK.pkgs) {
            console.log(pkg);
          }
        }
      } catch (e) {
        logreport.error("Failed to edit .bin files " + e);
      }
      */
    }
    await AddLockFileToCwd(cwd, LOCK);
  } catch (e) {
    logreport.error("Failed to generate lock file " + e);
  }
  return {
    RequiresInstall: RequiresInstall,
    RequiresUninstall: RequiresUninstall,
  };
}
