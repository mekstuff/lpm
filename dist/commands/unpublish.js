var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import logreport from "../utils/logreport.js";
import pack from "./pack.js";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import { CreateLPMPackageDirectory, GetLPMPackagesDirectory, RemoveLPMPackageDirectory, RemovePackagesFromLPMJSON, } from "../utils/lpmfiles.js";
export default class unpublish extends pack {
    Unpublish(packagePath) {
        return __awaiter(this, void 0, void 0, function* () {
            packagePath = packagePath || ".";
            const { success, result } = yield ReadPackageJSON(packagePath);
            if (!success) {
                logreport.error(result);
            }
            if (!result || typeof result === "string") {
                return logreport.error("Something went wrong while packing");
            }
            if (!result.name) {
                return logreport.error("Package must have a name to unpublish.");
            }
            logreport.logwithelapse(`Unpublishing ${result === null || result === void 0 ? void 0 : result.name} ${result === null || result === void 0 ? void 0 : result.version}`, "UNPUBLISH");
            const packageinlpmdir = yield CreateLPMPackageDirectory(result.name);
            yield RemovePackagesFromLPMJSON([result.name]).then((removed) => {
                if (!removed) {
                    logreport(`Could not remove package to global json file! ${result.name} => ${packageinlpmdir}`);
                }
            });
            try {
                const Removed = yield RemoveLPMPackageDirectory(result.name);
                if (!Removed) {
                    logreport(`Failed to remove package file from global installation "${result.name}".\n\n You can manually delete it from here\n${yield GetLPMPackagesDirectory()}`);
                }
            }
            catch (err) {
                logreport.error("Failed to publish " + err);
            }
            logreport.endelapse("UNPUBLISH");
        });
    }
    build(program) {
        program
            .command("unpublish [packagePath]")
            .description("Unpublishes your package to the local registry.")
            .action((packagePath) => __awaiter(this, void 0, void 0, function* () {
            this.Unpublish(packagePath);
        }));
    }
    constructor() {
        super();
    }
}
//# sourceMappingURL=unpublish.js.map