import fs from "fs";
import path from "path";
import chalk from "chalk";
import moment from "moment";
import crypto from "crypto";
import enqpkg from "enquirer";
const { prompt } = enqpkg;

import { program as CommanderProgram } from "commander";
import {
  GetLPMDirectory,
  GetLPMPackagesJSON,
  ReadLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import { RequiresLPMConfigSet } from "../utils/lpmconfig.js";
import { Console } from "@mekstuff/logreport";

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
    Console.error("Failed To Get Backups => " + e);
  }
}

export async function BackUpLPMPackagesJSON(noLogs?: boolean) {
  if (noLogs !== false) {
    noLogs = true; //Backup info clouds console more. so unless explicitly set noLogs to false, disable logs.
  }
  try {
    const JSON_STR = fs.readFileSync(await GetLPMPackagesJSON(), "utf8");
    const JSON_Package = await ReadLPMPackagesJSON();

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
      Console.info("Wrote new backup file => " + FinalDir);
    }
    fs.readdirSync(backupsDirectoryPath).forEach((backupfile) => {
      const backupfilePath = path.join(backupsDirectoryPath, backupfile);
      if (backupfilePath !== FinalDir) {
        try {
          const oldBackFilestr = fs.readFileSync(backupfilePath, "utf8");
          if (oldBackFilestr === JSON_STR) {
            if (!noLogs) {
              Console.warn(`Removing backupfile '${backupfile}'.`);
            }
            fs.rmSync(backupfilePath);
          }
        } catch (e) {
          if (!noLogs) {
            Console.warn(
              "Failed to work with previous backupfile => " + backupfilePath
            );
          }
        }
      }
    });
    const ndir = fs.readdirSync(backupsDirectoryPath);
    const config = await RequiresLPMConfigSet(["maximum-local-pkgs-backups"]);
    const mlpb = Number(config["maximum-local-pkgs-backups"]);
    if (ndir.length > mlpb) {
      const trmv = ndir.length - mlpb;
      ndir
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(backupsDirectoryPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => a.time - b.time)
        .map((file) => file.name)
        .forEach((x, i) => {
          if (i <= trmv) {
            fs.rmSync(path.join(backupsDirectoryPath, x));
          }
        });
    }
  } catch (e) {
    Console.warn("Something wen't wrong with backing up => " + e);
  }
}

export default class backup {
  build(program: typeof CommanderProgram) {
    const backup_program = program.command("backup").action(async () => {
      await BackUpLPMPackagesJSON(false);
    });
    backup_program
      .command("git")
      .description("Backup current pkgs json file to a git repository")
      .action(async () => {
        // const config = await RequiresLPMConfigSet(["git-backup-repository"]);
        // const backupdir = await GetLPMInstallationsBackup();
      });

    backup_program.command("revert").action(async () => {
      try {
        const Dir = await GetLPMInstallationBackupDir();
        Console.info("Backups located at: " + Dir, "log", true);
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
            Console.error("Failed to read backup file " + R.result);
          }
          if (typeof R.result === "string") {
            return Console.error("Something went wrong.");
          }
          fs.writeFileSync(
            await GetLPMPackagesJSON(),
            JSON.stringify(R.result, undefined, 2),
            { encoding: "utf8" }
          );
          Console.log(
            "Reverted to backed up file => " + (await GetLPMPackagesJSON())
          );
        });
      } catch (err) {
        Console.log("Failed to revert to backup => " + err);
      }
    });
  }
}
