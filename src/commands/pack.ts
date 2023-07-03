import fs from "fs";
import path from "path";
import tar from "tar";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import { ReadPackageJSON } from "../utils/PackageReader.js";

interface PackOptions {
  out?: string;
}

async function GetPackageFiles(PackagePath: string, packageJson: object) {
  logreport.assert(PackagePath !== undefined, "Package Path Not Passed.");
  logreport.assert(packageJson !== undefined, "Package JSON Not Passed.");

  const MUST_INCLUDE = ["package.json"];
  let MUST_EXCLUDE = [".gitignore", "node_modules", "yarn-error"];
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
  return files;
}

export default class pack {
  async Pack(
    packagePath: string | undefined,
    Options: PackOptions
  ): Promise<string | undefined> {
    packagePath = packagePath || ".";
    logreport.logwithelapse(`Fetching Information "${packagePath}"...`, "PACK");
    const { success, result } = await ReadPackageJSON(packagePath);
    if (!success) {
      logreport.error(result);
    }
    if (!result || typeof result === "string") {
      return logreport.error("Something went wrong while packing") as undefined;
    }
    Options.out = Options.out || `${result.name}-v${result.version}.tgz`;
    logreport.logwithelapse(`Packaging "${result.name}"...`, "PACK");
    const MapPack = await GetPackageFiles(packagePath, result).catch((err) => {
      logreport.error("Could not get files to pack " + err);
    });
    if (MapPack) {
      const Pack: string[] = [];
      MapPack.forEach((v) => {
        Pack.push(v);
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
    const outpath = path.resolve(path.join(packagePath, Options.out));
    logreport.logwithelapse(`Packaged => "${outpath}"`, "PACK", true);
    return outpath;
  }
  build(program: typeof CommanderProgram) {
    program
      .command("pack [packagePath]")
      .option("-o, --out", "Where to put tar file.")
      //   .option("-p, --packer", "What package manager to use to package.")
      .description("Packs package to be prepared to publish.")
      .action((packagePath, options) => {
        this.Pack(packagePath, options);
      });
  }
}
