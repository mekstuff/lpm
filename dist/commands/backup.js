var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from "fs";
import path from "path";
import chalk from "chalk";
import moment from "moment";
import crypto from "crypto";
import { GetLPMDirectory, GetLPMPackagesJSON, ReadLPMPackagesJSON, } from "../utils/lpmfiles.js";
import logreport from "../utils/logreport.js";
import enqpkg from "enquirer";
import { ReadPackageJSON } from "../utils/PackageReader.js";
const { prompt } = enqpkg;
export function GetLPMInstallationBackupDir() {
    return __awaiter(this, void 0, void 0, function* () {
        return path.join(yield GetLPMDirectory(), "installation-backups");
    });
}
export function GetLPMInstallationsBackup() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dir = yield GetLPMInstallationBackupDir();
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            return fs.readFileSync(dir, "utf8");
        }
        catch (e) {
            logreport.error("Failed To Get Backups => " + e);
        }
    });
}
export function BackUpLPMPackagesJSON(noLogs) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const JSON_STR = fs.readFileSync(yield GetLPMPackagesJSON(), "utf8");
            const JSON_Package = yield ReadLPMPackagesJSON();
            // const JSON_STR = JSON.stringify(JSON_Package);
            const backupsDirectoryPath = yield GetLPMInstallationBackupDir();
            const backupsExist = fs.existsSync(backupsDirectoryPath);
            if (!backupsExist) {
                fs.mkdirSync(backupsDirectoryPath, { recursive: true });
            }
            const FinalDir = path.join(backupsDirectoryPath, crypto.randomBytes(3).toString("hex") + ".json");
            fs.writeFileSync(FinalDir, JSON.stringify(JSON_Package, null, 2));
            if (!noLogs) {
                logreport("Wrote new backup file => " + FinalDir, "log", chalk.green("BACKUP: "));
            }
            fs.readdirSync(backupsDirectoryPath).forEach((backupfile) => {
                const backupfilePath = path.join(backupsDirectoryPath, backupfile);
                if (backupfilePath !== FinalDir) {
                    try {
                        const oldBackFilestr = fs.readFileSync(backupfilePath, "utf8");
                        if (oldBackFilestr === JSON_STR) {
                            if (!noLogs) {
                                logreport(`Removing backupfile '${backupfile}'.`, "log", chalk.yellow("BACKUP: "));
                            }
                            fs.rmSync(backupfilePath);
                        }
                    }
                    catch (e) {
                        if (!noLogs) {
                            logreport.warn("Failed to work with previous backupfile => " + backupfilePath, undefined, chalk.red("BACKUP: "));
                        }
                    }
                }
            });
        }
        catch (e) {
            logreport.warn("Something wen't wrong with backing up => " + e);
        }
    });
}
export default class backup {
    build(program) {
        const backup_program = program.command("backup").action(() => __awaiter(this, void 0, void 0, function* () {
            yield BackUpLPMPackagesJSON();
        }));
        backup_program.command("revert").action(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const Dir = yield GetLPMInstallationBackupDir();
                logreport("Backups located at: " + Dir, "log", true);
                const Backups = [];
                for (const Backup of fs.readdirSync(Dir)) {
                    const stats = fs.statSync(path.join(Dir, Backup));
                    Backups.unshift({
                        name: Backup,
                        message: Backup.toString() +
                            ` (${chalk.blue(moment(stats.birthtimeMs).fromNow())})\n${path.relative(process.cwd(), path.join(Dir, Backup))}\n`,
                        // value: path.join(Dir, Backup),
                    });
                }
                yield prompt({
                    name: "file",
                    message: "Select a backup file.",
                    type: "select",
                    choices: Backups,
                }).then((x) => __awaiter(this, void 0, void 0, function* () {
                    const R = yield ReadPackageJSON(yield GetLPMInstallationBackupDir(), x.file);
                    if (R.success === false) {
                        logreport.error("Failed to read backup file " + R.result);
                    }
                    if (typeof R.result === "string") {
                        return logreport.error("Something went wrong.");
                    }
                    fs.writeFileSync(yield GetLPMPackagesJSON(), JSON.stringify(R.result, undefined, 2), { encoding: "utf8" });
                    // await WriteLPMPackagesJSON(R.result as object);
                    logreport("Reverted to backed up file => " + (yield GetLPMPackagesJSON()));
                }));
            }
            catch (err) {
                logreport("Failed to revert to backup => " + err);
            }
        }));
    }
}
//# sourceMappingURL=backup.js.map