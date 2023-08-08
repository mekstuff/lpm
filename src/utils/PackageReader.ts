import fs from "fs";
import path from "path";
import logreport from "./logreport.js";
import semver from "semver";

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

const SemVersionSymbols = ["^", "~", "!"];
export type SemVersionSymbol = (typeof SemVersionSymbols)[number];
export interface IParsedPackageNameResults {
  PackageName: string;
  OrginizationName: string;
  PackageVersion: string;
  FullPackageName: string;
  FullResolvedName: string;
  SemVersionSymbol: SemVersionSymbol;
  FullSemVerResolvedName: string;
  VersionWithSymbol: string;
}

const ParseCache = new Map<string, IParsedPackageNameResults>();

export function ParsePackageName(
  Name: string,
  appendVersion?: string,
  forceSemverSymbol?: SemVersionSymbol
): IParsedPackageNameResults {
  if (appendVersion) {
    Name += "@" + appendVersion;
  }
  if (ParseCache.has(Name)) {
    return ParseCache.get(Name) as IParsedPackageNameResults;
  }
  const s = Name.split("/");
  let PackageName = s[1] ? s[1] : s[0];
  const OrginizationName = s[1] ? s[0] : "";
  const VersionSplit = PackageName.split("@");
  let PackageVersion = "latest";
  if (VersionSplit.length > 1) {
    PackageVersion = VersionSplit[1];
    PackageName = VersionSplit[0];
  }
  let SemVersionSymbol: SemVersionSymbol = forceSemverSymbol || "^";
  const fVersionChar = PackageVersion.match(/[^s;]/);
  if (fVersionChar) {
    const x = fVersionChar[0];
    const inx = SemVersionSymbols.indexOf(x);
    if (inx !== -1) {
      SemVersionSymbol = forceSemverSymbol || SemVersionSymbols[inx];
      PackageVersion = PackageVersion.slice(1);
    }
  }
  const FullPackageName =
    OrginizationName !== ""
      ? OrginizationName + "/" + PackageName
      : PackageName;
  const res: IParsedPackageNameResults = {
    PackageName,
    OrginizationName,
    PackageVersion,
    FullPackageName,
    FullResolvedName: FullPackageName + "@" + PackageVersion,
    FullSemVerResolvedName:
      FullPackageName + "@" + SemVersionSymbol + PackageVersion,
    SemVersionSymbol: SemVersionSymbol,
    VersionWithSymbol: `${SemVersionSymbol}${PackageVersion}`,
  };
  ParseCache.set(Name, res);
  return res;
}

export async function ParseVersionString(
  Version: string,
  Options: semver.RangeOptions
) {
  return semver.parse(Version, Options);
}

export async function GetHighestVersion(
  Versions: string[],
  Version?: string,
  Options?: semver.RangeOptions
): Promise<string | null> {
  Version = Version || "*";
  const m = Version.match(/[^s;]/);
  if (m !== null && m[0] === "!") {
    return Version.slice(1);
  }
  if (Version === "latest" || Version.slice(1) === "latest") {
    Version = "*";
  }
  return semver.maxSatisfying(Versions, Version, Options);
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
