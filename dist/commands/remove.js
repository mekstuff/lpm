var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import chalk from "chalk";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { GetPreferredPackageManager } from "./add.js";
import logreport from "../utils/logreport.js";
import { GenerateLockFileAtCwd, ReadLockFileFromCwd, RemoveInstallationsToGlobalPackage, } from "../utils/lpmfiles.js";
import { exec } from "child_process";
export default class remove {
    Remove(Arg0, Options) {
        return __awaiter(this, void 0, void 0, function* () {
            const LOCKFILE = yield ReadLockFileFromCwd();
            if (!Options.packageManager) {
                Options.packageManager = GetPreferredPackageManager();
            }
            logreport.assert(SUPPORTED_PACKAGE_MANAGERS.indexOf(Options.packageManager) !==
                -1, `Unsupported package manager "${Options.packageManager}"`);
            const Packages = [];
            const PackageManagerFlags = [];
            Arg0.forEach((arg) => {
                if (!arg.match("^-")) {
                    Packages.push(arg);
                }
                else {
                    PackageManagerFlags.push(arg);
                }
            });
            logreport.logwithelapse(`Removing ${Packages.length} package${Packages.length === 1 ? "" : "s"}.`, "REMOVE_PKGS");
            Packages.forEach((pkg, index) => __awaiter(this, void 0, void 0, function* () {
                logreport.logwithelapse(`Fetching package ${chalk.blue(pkg)} [${index + 1} / ${Packages.length}]...`, "REMOVE_PKGS");
                if (!Options.skipLockCheck) {
                    if (!LOCKFILE.pkgs[pkg]) {
                        logreport.error(pkg +
                            " was not found in lock file. use `--skip-lock-check` to ignore this check.");
                    }
                }
            }));
            logreport.logwithelapse(`Removing from global installations...`, "REMOVE_PKGS");
            yield RemoveInstallationsToGlobalPackage(Packages, [process.cwd()]);
            logreport.logwithelapse(`Finished removing from global installations`, "REMOVE_PKGS");
            logreport.logwithelapse(`Removing from package manager ${chalk.blue(Options.packageManager)}...`, "REMOVE_PKGS");
            const execString = Options.packageManager +
                " remove " +
                Packages.join(" ") +
                PackageManagerFlags.join(" ");
            logreport(`Executing "${execString}"`, "VERBOSE");
            const p = new Promise((resolve) => {
                var _a, _b;
                const executed = exec(execString);
                executed.on("exit", (code) => {
                    resolve(code);
                });
                if (Options.showPmLogs) {
                    console.log("\n");
                }
                (_a = executed.stdout) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
                    var _a;
                    if (Options.showPmLogs) {
                        logreport(data.toString(), "log", chalk.blue(((_a = Options.packageManager) === null || _a === void 0 ? void 0 : _a.toUpperCase()) + " INFO "));
                    }
                });
                (_b = executed.stderr) === null || _b === void 0 ? void 0 : _b.on("data", (data) => {
                    var _a;
                    if (Options.showPmLogs) {
                        logreport(data.toString(), "log", chalk.blue(((_a = Options.packageManager) === null || _a === void 0 ? void 0 : _a.toUpperCase()) + " INFO "));
                    }
                });
            });
            logreport(`Exit Code "${yield p}"`, "VERBOSE");
            logreport.logwithelapse(`Removed from package manager with exit code ${yield p}`, "REMOVE_PKGS");
            logreport.logwithelapse(`Generating LOCK file...`, "REMOVE_PKGS");
            yield GenerateLockFileAtCwd();
            logreport.logwithelapse(`LOCK file Generated`, "REMOVE_PKGS", true);
        });
    }
    build(program) {
        program
            .command("remove <packages...>")
            .allowUnknownOption(true)
            .description("Remove a package to your project. Any Unknown Options will be sent to the package manager.")
            .option("-pm, --package-manager [string]", "The package manager to use.")
            .option("--skip-lock-check [string]", "Skips checking for package within the lock file.")
            .option("--show-pm-logs [string]", "Show package managers output in terminal.")
            .action((packages, options) => {
            this.Remove(packages, options);
        });
    }
}
//# sourceMappingURL=remove.js.map