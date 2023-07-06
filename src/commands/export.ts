import fs from "fs";
import os from "os";
import path from "path";
import chalk from "chalk";
import crypto from "crypto";
import logreport from "../utils/logreport.js";
import { getcommand } from "../index.js";
import { program as CommanderProgram } from "commander";
import { GetLPMPackagesDirectory } from "../utils/lpmfiles.js";

export default class EXPORT {
  async export(files: string[], options: { scope?: string }) {
    if (!Array.isArray(files)) {
      logreport.error(
        "Expected an array of strings for files, got " + typeof files
      );
    }
    if (options.scope !== undefined) {
      logreport.assert(typeof options.scope === "string", "Not a valid scope");
    }
    files.forEach(async (file, index) => {
      const ResolvedPath = path.resolve(file);
      const FileExists = fs.existsSync(ResolvedPath);
      if (!FileExists) {
        return logreport.error(`"${ResolvedPath}" does not exist.`);
      }
      logreport.assert(
        typeof file === "string",
        "file expected to be a string."
      );
      const BaseName = path.basename(ResolvedPath);
      if (BaseName === "package") {
        logreport.error("The name 'package' cannot be used to export.");
      }
      const PackageName =
        "@_exports/" +
        (options.scope ? options.scope + "/" : "") +
        path.parse(BaseName).name;
      logreport(
        `Exporting ${file} as ${chalk.bold(chalk.cyan(PackageName))} [${
          index + 1
        }/${files.length}] `,
        "log",
        true
      );
      const TEMP_DIR_NAME =
        "lpm-export-" + crypto.randomBytes(4).toString("hex");
      const TEMP_DIR_PATH = path.join(os.tmpdir(), TEMP_DIR_NAME);

      try {
        fs.mkdirSync(TEMP_DIR_PATH);
        fs.cpSync(file, path.join(TEMP_DIR_PATH, BaseName));
        const PUBLISH_JSON = {
          name: PackageName,
          version: "1.0.0",
          description: `You can import this package by running "lpm import ${PackageName}"`,
        };
        fs.writeFileSync(
          path.join(TEMP_DIR_PATH, "package.json"),
          JSON.stringify(PUBLISH_JSON, undefined, 2),
          "utf8"
        );

        //publishing
        const Publish = getcommand("publish");
        await Publish.Publish(TEMP_DIR_PATH, {});

        //removing the package.json file from the pkg directory
        const pkgsDirectory = await GetLPMPackagesDirectory();
        try {
          fs.rmSync(
            path.join(pkgsDirectory, PackageName, "pkg", "package.json"),
            {
              recursive: true,
            }
          );
        } catch (e) {
          logreport.warn("Could not remove package.json file " + e);
        }

        //removing temp dir
        fs.rmSync(TEMP_DIR_PATH, { recursive: true });
      } catch (err) {
        logreport.error(`Could export package. => ${err}`);
      }
    });
  }
  build(program: typeof CommanderProgram) {
    program
      .command("export <files...>")
      .option(
        "-s, --scope [string]",
        "A scope to publish the files under, all exports are under a '@_exports'. --scope='@myscope' results in @_exports/@myscope/..."
      )
      .description(
        "publishes a file/directory that is not meant to be published to a registry but instead as reusable component."
      )
      .action(async (files, options) => {
        await this.export(files, options);
      });
  }
}
