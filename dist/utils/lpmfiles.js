var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import os from "os";
import path from "path";
import fs from "fs";
import logreport from "./logreport.js";
import { BackUpLPMPackagesJSON } from "../commands/backup.js";
const LPM_DIR = path.join(os.homedir(), ".local-package-manager");
export function CreateLPMPackageDirectory(PackageName) {
    return __awaiter(this, void 0, void 0, function* () {
        const dir = path.join(yield GetLPMPackagesDirectory(), PackageName);
        try {
            const exists = fs.existsSync(dir);
            if (exists) {
                fs.rmSync(dir, { recursive: true });
            }
        }
        catch (err) {
            logreport.error(err);
        }
        yield fs.promises
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
    });
}
export function RemoveLPMPackageDirectory(PackageName) {
    return __awaiter(this, void 0, void 0, function* () {
        const dir = path.join(yield GetLPMPackagesDirectory(), PackageName);
        try {
            const exists = fs.existsSync(dir);
            if (exists) {
                fs.rmSync(dir, { recursive: true });
                return true;
            }
        }
        catch (err) {
            logreport.error(err);
        }
        return false;
    });
}
export function GetLPMPackagesDirectory() {
    return __awaiter(this, void 0, void 0, function* () {
        const d = yield GetLPMDirectory().catch((e) => {
            logreport.error(e);
        });
        const LPM_PACKAGES_DIR = path.join(d, "packages");
        try {
            const LPM_PACKAGES_DIR_EXISTS = fs.existsSync(LPM_PACKAGES_DIR);
            if (!LPM_PACKAGES_DIR_EXISTS) {
                yield fs.promises
                    .mkdir(LPM_PACKAGES_DIR, { recursive: true })
                    .catch((e) => {
                    logreport.error(e);
                });
            }
        }
        catch (e) {
            logreport.error(e);
        }
        return LPM_PACKAGES_DIR;
        //   const dir = await GetLPM_DIRectory();
    });
}
export function GetLPMDirectory() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const LPM_DIRExists = fs.existsSync(LPM_DIR);
            if (!LPM_DIRExists) {
                yield fs.promises.mkdir(LPM_DIR, { recursive: true }).catch((e) => {
                    logreport.error(e);
                });
            }
        }
        catch (e) {
            logreport.error(e);
        }
        return LPM_DIR;
    });
}
export function GetLPMPackagesJSON() {
    return __awaiter(this, void 0, void 0, function* () {
        const PackagesJSONPath = path.join(yield GetLPMDirectory(), "pkgs.json");
        try {
            const LPM_PACKAGES_JSON_Exists = fs.existsSync(PackagesJSONPath);
            if (!LPM_PACKAGES_JSON_Exists) {
                yield fs.promises
                    .writeFile(PackagesJSONPath, JSON.stringify({
                    packages: {},
                }), "utf8")
                    .catch((e) => {
                    logreport.error(e);
                });
            }
        }
        catch (e) {
            logreport.error(e);
        }
        return PackagesJSONPath;
    });
}
const CorruptedGlobalRegistryJSONFileWarn = `Possibly corrupted global registry file. You can revert to a previous backed up version or manually try to fix the JSON file if you know what you're doing!\n\nRun 'lpm backup revert' to get to the backup wizard.\nRun 'lpm open json' to open json file.`;
export function ReadLPMPackagesJSON() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const LPMPackagesJSON = yield GetLPMPackagesJSON();
            const Data = JSON.parse(fs.readFileSync(LPMPackagesJSON, "utf8"));
            if (!Data.packages) {
                logreport.error(CorruptedGlobalRegistryJSONFileWarn);
            }
            return Data;
        }
        catch (e) {
            logreport.error(`${e} => ` + CorruptedGlobalRegistryJSONFileWarn);
        }
        return {};
    });
}
export function WriteLPMPackagesJSON(Data, options) {
    return __awaiter(this, void 0, void 0, function* () {
        logreport.assert(Data !== undefined, "Did not get any data to write to LPM Packages JSON.");
        if (typeof Data === "object") {
            Data = JSON.stringify(Data, null, 2);
        }
        let wrote = false;
        try {
            yield BackUpLPMPackagesJSON();
            fs.writeFileSync(yield GetLPMPackagesJSON(), Data, options || { encoding: "utf8" });
        }
        catch (e) {
            console.log("caught");
            wrote = false;
        }
        return wrote;
    });
}
export function AddPackagesToLPMJSON(Packages) {
    return __awaiter(this, void 0, void 0, function* () {
        logreport.assert(typeof Packages === "object", "Invalid Packages passed.");
        try {
            const LPMPackagesJSON = yield ReadLPMPackagesJSON();
            Packages.forEach((pkg) => __awaiter(this, void 0, void 0, function* () {
                const ExistingPkgData = LPMPackagesJSON.packages[pkg.name];
                const NewData = {
                    resolve: pkg.resolve,
                    installations: (ExistingPkgData && ExistingPkgData.installations) || [],
                };
                LPMPackagesJSON.packages[pkg.name] = NewData;
            }));
            const wrote = WriteLPMPackagesJSON(LPMPackagesJSON);
            if (!wrote) {
                logreport("Failed to write to LPM Packages.", "error");
            }
        }
        catch (e) {
            logreport.error(e);
        }
        return true;
    });
}
export function RemovePackagesFromLPMJSON(Packages) {
    return __awaiter(this, void 0, void 0, function* () {
        logreport.assert(typeof Packages === "object", "Invalid Packages passed.");
        try {
            const LPMPackagesJSON = yield ReadLPMPackagesJSON();
            Packages.forEach((pkg) => __awaiter(this, void 0, void 0, function* () {
                if (LPMPackagesJSON.packages[pkg]) {
                    delete LPMPackagesJSON.packages[pkg];
                }
                else {
                    logreport(`${pkg} was not published.`, "warn", true);
                }
            }));
            const wrote = WriteLPMPackagesJSON(LPMPackagesJSON);
            if (!wrote) {
                logreport("Failed to write to LPM Packages.", "error");
            }
        }
        catch (e) {
            logreport.error(e);
        }
        return true;
    });
}
export function AddInstallationsToGlobalPackage(packageNames, Installations) {
    return __awaiter(this, void 0, void 0, function* () {
        const LPMPackagesJSON = yield ReadLPMPackagesJSON();
        packageNames.forEach((packageName) => {
            const TargetPackage = LPMPackagesJSON.packages[packageName];
            if (!TargetPackage) {
                logreport.error(`${packageName} was not found in the local package registry.`);
            }
            let OldInstallationData = TargetPackage.installations;
            if (!OldInstallationData) {
                logreport(`No Installations was found on package ${packageName}. Check backups to find previous installations of this package.`, "warn");
                OldInstallationData = [];
            }
            TargetPackage.installations = [
                ...new Set([...OldInstallationData, ...Installations]),
            ];
            WriteLPMPackagesJSON(LPMPackagesJSON);
        });
    });
}
export function RemoveInstallationsToGlobalPackage(packageNames, Installations) {
    return __awaiter(this, void 0, void 0, function* () {
        const LPMPackagesJSON = yield ReadLPMPackagesJSON();
        packageNames.forEach((packageName) => {
            const TargetPackage = LPMPackagesJSON.packages[packageName];
            if (!TargetPackage) {
                logreport.error(`${packageName} was not found in the local package registry.`);
            }
            TargetPackage.installations = TargetPackage.installations.filter((e) => {
                const f = Installations.indexOf(e);
                if (f !== -1) {
                    return false;
                }
            });
            WriteLPMPackagesJSON(LPMPackagesJSON);
        });
    });
}
export function ReadLockFileFromCwd(cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        cwd = cwd || ".";
        try {
            if (!fs.existsSync(path.join(cwd, "lpm.lock"))) {
                logreport.error(`No lock file exists in ${path.resolve(cwd)}.`);
            }
            return JSON.parse(fs.readFileSync(path.join(cwd, "lpm.lock"), "utf8"));
        }
        catch (e) {
            logreport.error(`Could not read lock file ${path.resolve(cwd, "lpm.lock")}.`);
        }
        return {};
    });
}
export function AddLockFileToCwd(cwd, data) {
    return __awaiter(this, void 0, void 0, function* () {
        cwd = cwd || process.cwd();
        try {
            if (!fs.existsSync(path.join(cwd, "lpm.lock"))) {
                fs.writeFileSync(path.join(cwd, "lpm.lock"), JSON.stringify(data || {}, undefined, 2));
            }
            else {
                if (data) {
                    fs.writeFileSync(path.join(cwd, "lpm.lock"), JSON.stringify(data || {}, undefined, 2));
                }
            }
        }
        catch (e) {
            logreport.error("Could not create lock file " + cwd);
        }
    });
}
export function GenerateLockFileAtCwd(cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        cwd = cwd || process.cwd();
        yield AddLockFileToCwd(cwd);
        try {
            /*
            const PreviousLockfileData: LOCKFILE = JSON.parse(
              fs.readFileSync(path.join(cwd, "lpm.lock")).toString()
            );
            */
            const LPMPackagesJSON = yield ReadLPMPackagesJSON();
            const LOCK = {
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
                yield AddLockFileToCwd(cwd, LOCK);
            }
        }
        catch (e) {
            logreport.error("Failed to generate lock file " + e);
        }
    });
}
//# sourceMappingURL=lpmfiles.js.map