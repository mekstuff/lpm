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
import { ReadLPMPackagesJSON, ReadLockFileFromCwd } from "../utils/lpmfiles.js";
import LogTree from "console-log-tree";
import { ReadPackageJSON } from "../utils/PackageReader.js";
export default class list {
    List(targetPackage, Options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!Options.all) {
                const PackageJSON = yield ReadPackageJSON(process.cwd());
                if (PackageJSON.success === false ||
                    typeof PackageJSON.result === "string") {
                    return;
                }
                const LockFile = yield ReadLockFileFromCwd();
                const tree = [];
                const subTreeChildren = [];
                for (const Package in LockFile.pkgs) {
                    if (targetPackage && targetPackage !== Package) {
                        continue;
                    }
                    subTreeChildren.push({
                        name: Package,
                    });
                }
                tree.push({
                    name: (_a = PackageJSON.result) === null || _a === void 0 ? void 0 : _a.name,
                    children: subTreeChildren,
                });
                console.log(LogTree.parse(tree));
                return;
            }
            //--all
            const LPMPackagesJSON = yield ReadLPMPackagesJSON();
            const tree = [];
            for (const Package in LPMPackagesJSON.packages) {
                if (targetPackage && targetPackage !== Package) {
                    continue;
                }
                const children = [];
                LPMPackagesJSON.packages[Package].installations.forEach((installation) => {
                    let name;
                    try {
                        name = JSON.parse(fs
                            .readFileSync(path.join(installation, "package.json"))
                            .toString()).name;
                    }
                    catch (e) {
                        name = installation + " | " + chalk.red("No package.json");
                    }
                    if (fs.existsSync(path.join(process.cwd(), "node_modules", Package))) {
                        name += " | " + chalk.yellow("Not installed.");
                    }
                    children.push({
                        name: name,
                    });
                });
                tree.push({
                    name: Package,
                    children: children,
                });
            }
            console.log(LogTree.parse(tree));
        });
    }
    build(program) {
        program
            .command("list [packageName]")
            .description("List lpm packages")
            .option("-a, --all", "List all published packages")
            .action((targetPackage, options) => {
            this.List(targetPackage, options);
        });
    }
}
//# sourceMappingURL=list.js.map