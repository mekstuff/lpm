import fs from "fs";
import path from "path";
import tar from "tar";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import { ReadPackageJSON } from "../utils/PackageReader.js";
import { execSync } from "child_process";
import { ReadLockFileFromCwd } from "../utils/lpmfiles.js";

interface PackOptions {
  out?: string;
  scripts?: boolean;
}

async function GetPackageFiles(PackagePath: string, packageJson: object) {
  logreport.assert(PackagePath !== undefined, "Package Path Not Passed.");
  logreport.assert(packageJson !== undefined, "Package JSON Not Passed.");

  /**
   * We must include `lpm.lock` for when we do lpm run-release it will make sure all packages are set to versions instead of link paths.
   */
  const MUST_INCLUDE = ["package.json"];
  let MUST_EXCLUDE = [".gitignore", "node_modules", "yarn-error.log"];

  /**
   * We must include `lpm.lock` for when we do lpm run-release it will make sure all packages are set to versions instead of link paths.
   */
  try {
    const LOCK = fs.existsSync(path.join(PackagePath, "lpm.lock"));
    if (LOCK) {
      MUST_INCLUDE.push("lpm.lock");
    }
  } catch (e) {}
  // adding ignore files from .gitignore
  try {
    const HasGitIgnore = fs.readFileSync(
      path.join(PackagePath, ".gitignore"),
      "utf8"
    );
    const ignore = HasGitIgnore.match(/([^\n]+)/g);
    if (ignore) {
      ignore.forEach((v, i) => {
        ignore[i] = v.replace("\r", "");
      });
      MUST_EXCLUDE = [...MUST_EXCLUDE, ...ignore];
    }
  } catch (e) {}
  // adding ignore from .npmignore
  try {
    const HasNpmIgnore = fs.readFileSync(
      path.join(PackagePath, ".gitignore"),
      "utf8"
    );
    const ignore = HasNpmIgnore.match(/([^\n]+)/g);
    if (ignore) {
      ignore.forEach((v, i) => {
        ignore[i] = v.replace("\r", "");
      });
      MUST_EXCLUDE = [...MUST_EXCLUDE, ...ignore];
    }
  } catch (e) {}

  const files = new Map<string, string>();
  const hasFilesField = (packageJson as { files?: string[] }).files;
  if (hasFilesField) {
    Object.entries(hasFilesField).forEach((f) => {
      const v = f[1];
      files.set(v, v);
    });
  } else {
    const dir = await fs.promises.readdir(PackagePath).catch((e) => {
      logreport.error(e);
    });
    Object.entries(dir as []).forEach((f) => {
      const d = f[1];
      files.set(d, path.join(PackagePath, d));
    });
  }
  MUST_EXCLUDE.forEach((e) => {
    files.delete(e);
  });
  MUST_INCLUDE.forEach((e) => {
    if (!files.get(e)) {
      files.set(e, e);
    }
  });
  console.log(files);
  return files;
}

export default class pack {
  async Pack(
    packagePath: string | undefined,
    Options: PackOptions
  ): Promise<string | undefined> {
    if (packagePath === undefined) {
      packagePath = ".";
    }
    logreport.logwithelapse(`Fetching Information "${packagePath}"...`, "PACK");
    const { success, result } = await ReadPackageJSON(packagePath);
    if (!success) {
      logreport.error(result);
    }
    if (!result || typeof result === "string") {
      return logreport.error("Something went wrong while packing") as undefined;
    }
    if (result.scripts) {
      if (Options.scripts) {
        const PrePackScript = result.scripts["prepack"];
        if (PrePackScript) {
          logreport("Running `prepack` script", "log", true);
          execSync(PrePackScript, {
            cwd: packagePath,
            stdio: "inherit",
          });
        }
      } else {
        logreport.warn(
          "scripts detected but `--no-scripts` flag was passed, not executing."
        );
      }
    }
    Options.out = Options.out || `${result.name}-v${result.version}.tgz`;
    logreport.logwithelapse(`Packaging "${result.name}"...`, "PACK");
    const MapPack = await GetPackageFiles(packagePath, result).catch((err) => {
      logreport.error("Could not get files to pack " + err);
    });
    if (MapPack) {
      const Pack: string[] = [];
      MapPack.forEach((v) => {
        Pack.push(path.relative(packagePath as string, v));
      });
      try {
        tar.c(
          {
            cwd: packagePath,
            file: Options.out,
            sync: true,
          },
          Pack
        );
      } catch (e) {
        logreport.error("Could not create tar file " + e);
      }
    } else {
      logreport.error("Did not get files to pack.");
    }
    // const outpath = path.resolve(path.join(packagePath, Options.out));
    const outpath = path.resolve(Options.out);
    logreport.logwithelapse(`Packaged => "${outpath}"`, "PACK", true);
    return outpath;
  }
  build(program: typeof CommanderProgram) {
    program
      .command("pack [packagePath]")
      .option("-o, --out", "Where to put tar file.")
      .option("--no-scripts [boolean]", "Running any pack related scripts.")
      //   .option("-p, --packer", "What package manager to use to package.")
      .description("Packs package to be prepared to publish.")
      .action((packagePath, options) => {
        this.Pack(packagePath, options);
      });
  }
}
