import os from "os";
import path from "path";
import fs from "fs";
import logreport from "./logreport.js";
import { BackUpLPMPackagesJSON } from "../commands/backup.js";

const LPM_DIR = path.join(os.homedir(), ".local-package-manager");

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
    console.log("caught");
    wrote = false;
  }
  return wrote;
}

type ILPMPackagesJSON_Package = { resolve: string; installations: string[] };
interface ILPMPackagesJSON {
  packages: { [key: string]: ILPMPackagesJSON_Package };
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
    WriteLPMPackagesJSON(LPMPackagesJSON);
  });
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
        `${packageName} was not found in the local package registry.`
      );
    }
    TargetPackage.installations = TargetPackage.installations.filter((e) => {
      const f = Installations.indexOf(e);
      if (f !== -1) {
        return false;
      }
    });
    WriteLPMPackagesJSON(LPMPackagesJSON);
  });
}

//LOCK
type LOCKFILEPKG = { resolve: string };
interface LOCKFILE {
  pkgs: { [key: string]: LOCKFILEPKG };
}

export async function ReadLockFileFromCwd(cwd?: string): Promise<LOCKFILE> {
  cwd = cwd || ".";
  try {
    if (!fs.existsSync(path.join(cwd, "lpm.lock"))) {
      logreport.error(`No lock file exists in ${path.resolve(cwd)}.`);
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

export async function GenerateLockFileAtCwd(cwd?: string) {
  cwd = cwd || process.cwd();
  await AddLockFileToCwd(cwd);
  try {
    /*
    const PreviousLockfileData: LOCKFILE = JSON.parse(
      fs.readFileSync(path.join(cwd, "lpm.lock")).toString()
    );
    */
    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const LOCK: LOCKFILE = {
      pkgs: {},
    };
    for (const Package in LPMPackagesJSON.packages) {
      // const PreviousInLock =(PreviousLockfileData.pkgs && PreviousLockfileData.pkgs[Package]) || {};
      const PackageData = LPMPackagesJSON.packages[Package];
      PackageData.installations.forEach((installation) => {
        if (installation === cwd) {
          if (!LOCK.pkgs[Package]) {
            LOCK.pkgs[Package] = {
              resolve: PackageData.resolve,
              // pm: PreviousInLock.pm || undefined,
            };
          }
        }
      });
      await AddLockFileToCwd(cwd, LOCK);
    }
  } catch (e) {
    logreport.error("Failed to generate lock file " + e);
  }
}
