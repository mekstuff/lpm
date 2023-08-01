import fs from "fs";
import path from "path";
import logreport from "./logreport.js";

interface PackageFileRequired {
  name: string;
  version: string;
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
  optionalDependencies: { [key: string]: string };
  peerDependencies: { [key: string]: string };
  scripts: { [key: string]: string };
  bin: { [key: string]: string };
}

export type PackageFile = Partial<PackageFileRequired>;

export async function ParsePackageName(Name: string): Promise<{
  PackageName: string;
  OrginizationName: string;
}> {
  const s = Name.split("/");
  return {
    OrginizationName: s[1] ? s[0] : "",
    PackageName: s[1] ? s[1] : s[0],
  };
}

export async function ReadPackageJSON(
  PackagePath: string,
  JsonFileName?: string,
  CreateOnNonExist?: boolean
): Promise<{ success: boolean; result: string | PackageFile }> {
  JsonFileName = JsonFileName || "package.json";
  const JSONPath = path.join(PackagePath, JsonFileName);
  const pathExists = fs.existsSync(JSONPath);
  if (!pathExists && !CreateOnNonExist) {
    logreport.warn(`"${JSONPath}" does not exist in path.`);
    return { success: false, result: `"${JSONPath}" does not exist in path.` };
  }
  if (!pathExists && CreateOnNonExist) {
    try {
      const write = {};
      fs.writeFileSync(JSONPath, JSON.stringify(write), "utf8");
      return {
        success: true,
        result: write,
      };
    } catch (err) {
      logreport.error(
        "Could not create package json file => " + JSONPath + ". Error: " + err
      );
      process.exit(1);
    }
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
