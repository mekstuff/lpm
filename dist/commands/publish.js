var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import path from "path";
import tar from "tar";
import logreport from "../utils/logreport.js";
import pack from "./pack.js";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import { AddPackagesToLPMJSON, CreateLPMPackageDirectory, GetLPMPackagesDirectory, } from "../utils/lpmfiles.js";
import { execSync } from "child_process";
import { BackUpLPMPackagesJSON } from "./backup.js";
export default class publish extends pack {
    Publish(packagePath, Options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield BackUpLPMPackagesJSON();
            packagePath = packagePath || ".";
            const { success, result } = yield ReadPackageJSON(packagePath);
            if (!success) {
                logreport.error(result);
            }
            if (!result || typeof result === "string") {
                return logreport.error("Something went wrong while packing");
            }
            if (!result.name) {
                return logreport.error("Package must have a name to publish.");
            }
            logreport.logwithelapse(`Publishing ${result === null || result === void 0 ? void 0 : result.name} ${result === null || result === void 0 ? void 0 : result.version}`, "PUBLISH");
            if (result.scripts) {
                if (Options.scripts) {
                    const PrePublishOnlyScript = result.scripts["prepublishOnly"];
                    if (PrePublishOnlyScript) {
                        logreport("Running `prepublishOnly` script", "log", true);
                        execSync(PrePublishOnlyScript, {
                            cwd: packagePath,
                            stdio: "inherit",
                        });
                    }
                }
                else {
                    logreport.warn("scripts detected but `--no-scripts` flag was passed, not executing.");
                }
            }
            const packageinlpmdir = yield CreateLPMPackageDirectory(result.name);
            yield AddPackagesToLPMJSON([
                { name: result.name, resolve: path.join(packageinlpmdir, "pkg") },
            ]).then((added) => {
                if (!added) {
                    logreport(`Could not add package to global json file! ${result.name} => ${packageinlpmdir}`);
                }
            });
            const tarbaldir = yield this.Pack(packagePath, {
                out: path.join(yield GetLPMPackagesDirectory(), result.name, "tarbal.tgz"),
            }).catch((err) => {
                console.error(err);
                logreport.error("Failed to pack. " + err);
            });
            try {
                tar.x({
                    file: tarbaldir,
                    cwd: path.join(packageinlpmdir, "pkg"),
                    sync: true,
                });
            }
            catch (err) {
                logreport.error("Failed to publish " + err);
            }
            logreport.endelapse("PUBLISH");
        });
    }
    build(program) {
        program
            .command("publish [packagePath]")
            .description("Packages and publishes your package to the local registry.")
            .option("--no-scripts [boolean]", "Does not run any scripts")
            .action((packagePath, Options) => __awaiter(this, void 0, void 0, function* () {
            this.Publish(packagePath, Options);
        }));
    }
    constructor() {
        super();
    }
}
//# sourceMappingURL=publish.js.map