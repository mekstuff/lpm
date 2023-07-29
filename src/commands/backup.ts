import fs from "fs";
import path from "path";
import chalk from "chalk";
import moment from "moment";
import crypto from "crypto";

import { program as CommanderProgram } from "commander";
import {
  GetLPMDirectory,
  GetLPMPackagesJSON,
  ReadLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import logreport from "../utils/logreport.js";
import enqpkg from "enquirer";
import { ReadPackageJSON } from "../utils/PackageReader.js";
const { prompt } = enqpkg;

export async function GetLPMInstallationBackupDir() {
  return path.join(await GetLPMDirectory(), "installation-backups");
}

export async function GetLPMInstallationsBackup() {
  try {
    const dir = await GetLPMInstallationBackupDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return fs.readFileSync(dir, "utf8");
  } catch (e) {
    logreport.error("Failed To Get Backups => " + e);
  }
}

export async function BackUpLPMPackagesJSON(noLogs?: boolean) {
  if (noLogs !== false) {
    noLogs = true; //Backup info clouds console more. so unless explicitly set noLogs to false, disable logs.
  }
  try {
    const JSON_STR = fs.readFileSync(await GetLPMPackagesJSON(), "utf8");
    const JSON_Package = await ReadLPMPackagesJSON();

    // const JSON_STR = JSON.stringify(JSON_Package);
    const backupsDirectoryPath = await GetLPMInstallationBackupDir();
    const backupsExist = fs.existsSync(backupsDirectoryPath);
    if (!backupsExist) {
      fs.mkdirSync(backupsDirectoryPath, { recursive: true });
    }

    const FinalDir = path.join(
      backupsDirectoryPath,
      crypto.randomBytes(3).toString("hex") + ".json"
    );

    fs.writeFileSync(FinalDir, JSON.stringify(JSON_Package, null, 2));
    if (!noLogs) {
      logreport(
        "Wrote new backup file => " + FinalDir,
        "log",
        chalk.green("BACKUP: ")
      );
    }
    fs.readdirSync(backupsDirectoryPath).forEach((backupfile) => {
      const backupfilePath = path.join(backupsDirectoryPath, backupfile);
      if (backupfilePath !== FinalDir) {
        try {
          const oldBackFilestr = fs.readFileSync(backupfilePath, "utf8");
          if (oldBackFilestr === JSON_STR) {
            if (!noLogs) {
              logreport(
                `Removing backupfile '${backupfile}'.`,
                "log",
                chalk.yellow("BACKUP: ")
              );
            }
            fs.rmSync(backupfilePath);
          }
        } catch (e) {
          if (!noLogs) {
            logreport.warn(
              "Failed to work with previous backupfile => " + backupfilePath,
              undefined,
              chalk.red("BACKUP: ")
            );
          }
        }
      }
    });
  } catch (e) {
    logreport.warn("Something wen't wrong with backing up => " + e);
  }
}

export default class backup {
  build(program: typeof CommanderProgram) {
    const backup_program = program.command("backup").action(async () => {
      await BackUpLPMPackagesJSON(false);
    });

    backup_program.command("revert").action(async () => {
      try {
        const Dir = await GetLPMInstallationBackupDir();
        logreport("Backups located at: " + Dir, "log", true);
        const Backups: { message: string; name: string }[] = [];
        for (const Backup of fs.readdirSync(Dir)) {
          const stats = fs.statSync(path.join(Dir, Backup));
          Backups.unshift({
            name: Backup,
            message:
              Backup.toString() +
              ` (${chalk.blue(
                moment(stats.birthtimeMs).fromNow()
              )})\n${path.relative(process.cwd(), path.join(Dir, Backup))}\n`,
            // value: path.join(Dir, Backup),
          });
        }
        await prompt<{ file: string }>({
          name: "file",
          message: "Select a backup file.",
          type: "select",
          choices: Backups,
        }).then(async (x) => {
          const R = await ReadPackageJSON(
            await GetLPMInstallationBackupDir(),
            x.file
          );
          if (R.success === false) {
            logreport.error("Failed to read backup file " + R.result);
          }
          if (typeof R.result === "string") {
            return logreport.error("Something went wrong.");
          }
          fs.writeFileSync(
            await GetLPMPackagesJSON(),
            JSON.stringify(R.result, undefined, 2),
            { encoding: "utf8" }
          );
          // await WriteLPMPackagesJSON(R.result as object);
          logreport(
            "Reverted to backed up file => " + (await GetLPMPackagesJSON())
          );
        });
      } catch (err) {
        logreport("Failed to revert to backup => " + err);
      }
    });
  }
}
