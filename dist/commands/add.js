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
import logreport from "../utils/logreport.js";
import { SUPPORTED_PACKAGE_MANAGERS } from "../utils/CONSTANTS.js";
import { AddInstallationsToGlobalPackage, GenerateLockFileAtCwd, GetLPMPackagesJSON, ReadLPMPackagesJSON, } from "../utils/lpmfiles.js";
import { exec } from "child_process";
export function GetPreferredPackageManager() {
    return "yarn";
}
export default class Add {
    Add(Arg0, Options) {
        return __awaiter(this, void 0, void 0, function* () {
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
            logreport.logwithelapse(`Installing ${Packages.length} package${Packages.length === 1 ? "" : "s"}.`, "INSTALL_PKGS");
            // let execString = "";
            let InstallPkgsCommandStr = "";
            const GlobalPkgsIndex = yield ReadLPMPackagesJSON();
            Packages.forEach((pkg, index) => __awaiter(this, void 0, void 0, function* () {
                logreport.logwithelapse(`Fetching package ${chalk.blue(pkg)} [${index + 1} / ${Packages.length}]...`, "INSTALL_PKGS");
                const InGlobalIndex = GlobalPkgsIndex.packages[pkg];
                if (!InGlobalIndex) {
                    logreport.error(`"${pkg}" was not found within the local package registry.`);
                }
                logreport.assert(typeof InGlobalIndex.resolve === "string", `"${pkg}" Package does not have a valid resolve field in global index!. ${yield GetLPMPackagesJSON()}`);
                logreport.assert(typeof InGlobalIndex.installations === "object", `"${pkg}" Package does not have a valid installations field in global index!. ${yield GetLPMPackagesJSON()}`);
                let str = InGlobalIndex.resolve;
                if (Options.packageManager !== "npm") {
                    str = "link:" + str;
                }
                InstallPkgsCommandStr += str + " ";
            }));
            yield AddInstallationsToGlobalPackage(Packages, [process.cwd()]);
            logreport.logwithelapse(`Finished Adding to global installations`, "INSTALL_PKGS");
            logreport.logwithelapse(`Installing with package manager ${chalk.blue(Options.packageManager)}...`, "INSTALL_PKGS");
            const execString = Options.packageManager +
                ` ${Options.packageManager === "yarn" ? "add" : "install"} ` +
                InstallPkgsCommandStr +
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
            logreport(`Exit Code "${p}"`, "VERBOSE");
            logreport.logwithelapse(`Installed with package manager with exit code ${yield p}`, "INSTALL_PKGS");
            logreport.logwithelapse(`Generating LOCK file...`, "INSTALL_PKGS");
            yield GenerateLockFileAtCwd();
            logreport.logwithelapse(`LOCK file Generated`, "INSTALL_PKGS", true);
        });
    }
    build(program) {
        program
            .command("add <packages...>")
            .allowUnknownOption(true)
            .description("Add a package to your project. Any Unknown Options will be sent to the package manager.")
            .option("-pm, --package-manager [string]", "The package manager to use.")
            .option("--show-pm-logs", "Show package managers output in terminal.")
            .action((packages, options) => {
            this.Add(packages, options);
        });
    }
}
//# sourceMappingURL=add.js.map