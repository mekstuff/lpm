import fs from "fs";
import logreport from "../utils/logreport.js";
import { program as CommanderProgram } from "commander";
import { ReadLPMPackagesJSON } from "../utils/lpmfiles.js";
import enqpkg from "enquirer";
import path from "path";
const { prompt } = enqpkg;

export default class IMPORT {
  async import(Packages: string[]) {
    logreport.Elapse(`Importing ${Packages.length} packages`, "IMPORT");
    const LPMPackages = await ReadLPMPackagesJSON();
    const LinkDirs: { name: string; resolve: string }[] = [];
    Packages.forEach((pkg) => {
      pkg = "@_exports/" + pkg;
      if (!LPMPackages.packages[pkg]) {
        logreport.error(`"${pkg}" was not found as a published package.`);
      } else {
        LinkDirs.push({
          name: pkg,
          resolve: LPMPackages.packages[pkg].resolve,
        });
      }
    });
    await prompt<{ select_dir: string }>({
      name: "select_dir",
      type: "input",
      initial: "./@imports",
      message: "Where should these packages be imported?",
    })
      .then((res) => {
        const Exists = fs.existsSync(res.select_dir);
        if (!Exists) {
          fs.mkdirSync(res.select_dir);
        }
        LinkDirs.forEach((dir) => {
          fs.symlinkSync(
            dir.resolve,
            path.join(res.select_dir, path.basename(dir.name))
          );
        });
      })
      .catch((err) => {
        logreport.error(err);
      });
  }

  build(program: typeof CommanderProgram) {
    program
      .command("import <packages...>")
      .description(
        "import published packages by creating a symlink. Does not install packages with package manager nor create lpm.lock or change package.json. This is entirely for just symlinking files that were published through `export`"
      )
      .action(async (packages) => {
        await this.import(packages);
      });
  }
}
