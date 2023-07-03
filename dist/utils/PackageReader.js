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
import logreport from "./logreport.js";
export function ReadPackageJSON(PackagePath, JsonFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        JsonFileName = JsonFileName || "package.json";
        const JSONPath = path.join(PackagePath, JsonFileName);
        const pathExists = fs.existsSync(JSONPath);
        if (!pathExists) {
            logreport.warn(`"${JSONPath}" does not exist in path.`);
            return { success: false, result: `"${JSONPath}" does not exist in path.` };
        }
        try {
            const value = fs.readFileSync(JSONPath);
            return {
                success: true,
                result: JSON.parse(value.toString()),
            };
        }
        catch (e) {
            logreport.warn(e);
            return { success: false, result: e };
        }
    });
}
export function WritePackageJSON(PackagePath, DataToWrite, JsonFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        JsonFileName = JsonFileName || "package.json";
        const JSONPath = path.join(PackagePath, JsonFileName);
        const pathExists = fs.existsSync(JSONPath);
        if (!pathExists) {
            logreport.warn(`"${JSONPath}" does not exist in path.`);
            return { success: false, result: `"${JSONPath}" does not exist in path.` };
        }
        try {
            fs.writeFileSync(JSONPath, DataToWrite, { encoding: "utf8" });
            return { success: true };
        }
        catch (e) {
            logreport.warn(e);
            return { success: false, result: e };
        }
    });
}
//# sourceMappingURL=PackageReader.js.map