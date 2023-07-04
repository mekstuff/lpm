import fs from "fs";
import path from "path";
import logreport from "./logreport.js";

interface PackageFileRequired {
  name: string;
  version: string;
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
  scripts: { [key: string]: string };
  bin: { [key: string]: string };
}

export type PackageFile = Partial<PackageFileRequired>;

export async function ReadPackageJSON(
  PackagePath: string,
  JsonFileName?: string
): Promise<{ success: boolean; result: string | PackageFile }> {
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
      result: JSON.parse(value.toString()) as PackageFile,
    };
  } catch (e) {
    logreport.warn(e);
    return { success: false, result: e as string };
  }
}

export async function WritePackageJSON(
  PackagePath: string,
  DataToWrite: string,
  JsonFileName?: string
): Promise<{ success: boolean; result?: string }> {
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
  } catch (e) {
    logreport.warn(e);
    return { success: false, result: e as string };
  }
}
