import fs from "fs";
import path from "path";
import { program as CommanderProgram } from "commander";
import logreport from "../utils/logreport.js";
import { ReadLockFileFromCwd, dependency_scope } from "../utils/lpmfiles.js";
import {
  ParsePackageName,
  ReadPackageJSON,
  WritePackageJSON,
} from "../utils/PackageReader.js";
import enqpkg from "enquirer";
import chalk from "chalk";
const { prompt } = enqpkg;
import LogTree, { Tree } from "console-log-tree";
import pluralize from "pluralize";

export default class preprare {
  async Prepare(
    safeproduction: boolean,
    Options: {
      production?: boolean;
      dev?: boolean;
      safeproductionWarn?: boolean;
      safeproductionError?: boolean;
    },
    packageDirectory?: string
  ) {
    packageDirectory = packageDirectory || process.cwd();
    if (safeproduction && (Options.dev || Options.production)) {
      logreport.error(
        "`--production` or `--dev` flags cannot be set while calling `prepare safeproduction`."
      );
    }
    if (Options.production && Options.dev) {
      logreport.error(
        "Both `--production` & `--dev` flags cannot be set while calling `prepare`."
      );
    }
    if (!Options.production && !Options.dev && !safeproduction) {
      logreport.error(
        "Must provide either `--production` or `--dev` flag when calling `prepare`."
      );
    }

    const LockFile = await ReadLockFileFromCwd(packageDirectory, true);
    if (LockFile === undefined) {
      return;
    }
    //prepare imported packages in .lpm dir if any.
    const localregpackagespath = path.join(packageDirectory, ".lpm");
    if (fs.existsSync(localregpackagespath)) {
      for (const p of fs.readdirSync(localregpackagespath)) {
        const s = p.split("--");
        const n = s[0];
        if (LockFile.pkgs[n] && !LockFile.pkgs[n].traverse_imports) {
          await this.Prepare(
            safeproduction,
            Options,
            path.join(localregpackagespath, p)
          ); //this might not work as intended
          // since one copy of a package is stored, if you traverse deps but also have it as a top level module, it might mess with
          // the file, messing up the linking. We may need to implement having ability to detect the difference.
        }
      }
    }
    const PackageFile = await ReadPackageJSON(packageDirectory);
    if (
      !PackageFile.success ||
      typeof PackageFile.result === "string" ||
      PackageFile.result === undefined
    ) {
      return logreport.error("Could not access package.json");
    }
    const tree: Tree[] = [];
    const subTreeChildren: Tree[] = [];
    const InDevModePackages: {
      n: string;
      v: string;
      ds: dependency_scope;
    }[] = [];
    // console.log("SAFE!", safeproduction, packageDirectory);

    PackageFile.result.dependencies = PackageFile.result.dependencies || {};

    for (const lockpkg in LockFile.pkgs) {
      if (LockFile.pkgs[lockpkg].install_type === "import") {
        continue;
      }
      const ParsedInfo = ParsePackageName(lockpkg);
      if (safeproduction) {
        const PackageJSON = await ReadPackageJSON(packageDirectory);
        if (!PackageJSON.success || typeof PackageJSON.result === "string") {
          return logreport.error("Could not read package.json");
        }
        const InJSON =
          PackageJSON.result?.[LockFile.pkgs[lockpkg].dependency_scope]?.[
            ParsedInfo.FullPackageName
          ];
        if (InJSON === "file:" + LockFile.pkgs[lockpkg].resolve) {
          InDevModePackages.push({
            n: ParsedInfo.FullPackageName,
            v: InJSON,
            ds: LockFile.pkgs[lockpkg].dependency_scope,
          });
        }
        // console.log("here", packageDirectory, lockpkg);
      } else {
        if (Options.production) {
          const pkgjson = await ReadPackageJSON(LockFile.pkgs[lockpkg].resolve);
          if (pkgjson.success === false && typeof pkgjson.result === "string") {
            logreport.error(
              `Could not access package.json for published packge "${lockpkg}" => ${pkgjson.result}`
            );
            return;
          }
          if (!pkgjson.result || typeof pkgjson.result === "string") {
            logreport.error("Something went wrong.");
            return;
          }
          if (pkgjson.result.version === undefined) {
            logreport.error(
              `Published package does not have "version" field. => ${lockpkg} => ${LockFile.pkgs[lockpkg].resolve}`
            );
            return;
          }
          if (pkgjson.result.name === undefined) {
            logreport.error(
              `Published package does not have "name" field. => ${lockpkg} => ${LockFile.pkgs[lockpkg].resolve}`
            );
            return;
          }

          subTreeChildren.push({
            name: `${chalk.green(ParsedInfo.FullResolvedName)} => ${chalk.green(
              "^" + ParsedInfo.PackageVersion
            )}`,
          });
          const scope = LockFile.pkgs[lockpkg].dependency_scope;
          const tdepscope = PackageFile.result[scope];
          if (!tdepscope) {
            logreport.error("Invalid dep: " + lockpkg);
            process.exit(1);
          }
          tdepscope[ParsedInfo.FullPackageName] =
            "^" + ParsedInfo.PackageVersion;
        } else {
          subTreeChildren.push({
            name: `${chalk.green(lockpkg)} ✓`,
          });
          const scope = LockFile.pkgs[lockpkg].dependency_scope;
          const tdepscope = PackageFile.result[scope];
          if (!tdepscope) {
            logreport.error("Invalid dep: " + lockpkg);
            process.exit(1);
          }
          tdepscope[ParsedInfo.FullPackageName] =
            "file:" + LockFile.pkgs[lockpkg].resolve;
        }
        tree.push({
          name: PackageFile.result.name as string,
          children: subTreeChildren,
        });
      }
    }
    if (safeproduction) {
      if (InDevModePackages.length > 0) {
        const msg =
          InDevModePackages.length +
          " " +
          ((InDevModePackages.length > 1 && "dependencies are") ||
            "dependency is") +
          ` using local registry files.\n\n${InDevModePackages.map(
            (x) => `${x.n} => ${x.v} | ${pluralize(x.ds, 1)}`
          ).join("\n")}`;
        if (Options.safeproductionError) {
          logreport.error(msg);
          return;
        }
        if (Options.safeproductionWarn) {
          logreport.warn(msg);
          return;
        }
        await prompt<{ run_safe: boolean }>({
          name: "run_safe",
          initial: true,
          message: msg + "\n\nShould we prepare for production?",
          type: "confirm",
        })
          .then(async (res) => {
            if (res.run_safe) {
              await this.Prepare(false, { production: true });
              logreport(
                "Run `lpm prepare --development` when you finish publishing/pushing your package to switch back to local registry dependencies.",
                "log",
                true
              );
            } else {
              logreport.error(
                "Package not ready for production. run `lpm prepare --production`"
              );
            }
          })
          .catch((err) => {
            logreport.error(
              "Package not ready for production. run `lpm prepare --production`\n\n" +
                err
            );
          });
      } else {
        logreport(
          `Your package "${PackageFile.result.name}" 📦 is already ready for production 🚀`,
          "log",
          true
        );
      }
    } else {
      const prefix = Options.production
        ? `${PackageFile.result.name} Ready For Production 🚀`
        : `${PackageFile.result.name} Ready For Development 🚧`;
      logreport(
        prefix + `${tree.length > 0 ? "\n" + LogTree.parse(tree) : ""}`
      );
      await WritePackageJSON(
        packageDirectory,
        JSON.stringify(PackageFile.result, null, 2)
      );
    }
  }
  async safeprod(
    packageDirectory: string,
    Options: { warn?: boolean; error?: boolean }
  ) {
    const LockFile = await ReadLockFileFromCwd(undefined, true);
    if (LockFile === undefined) {
      return;
    }
    const localregpackagespath = path.join(packageDirectory, ".lpm");
    if (fs.existsSync(localregpackagespath)) {
      for (const p of fs.readdirSync(localregpackagespath)) {
        const s = p.split("--");
        const n = s[0];
        if (LockFile.pkgs[n] && !LockFile.pkgs[n].traverse_imports) {
          await this.safeprod(path.join(localregpackagespath, p), Options);
        }
      }
    }
    const PackageJSON = await ReadPackageJSON(process.cwd());
    if (!PackageJSON.success || typeof PackageJSON.result === "string") {
      return logreport.error("Could not read package.json");
    }
    const InDevModePackages: {
      n: string;
      v: string;
      ds: dependency_scope;
    }[] = [];
    for (const pkg in LockFile.pkgs) {
      const ParsedInfo = ParsePackageName(pkg);
      const InJSON =
        PackageJSON.result?.[LockFile.pkgs[pkg].dependency_scope]?.[
          ParsedInfo.FullPackageName
        ];

      if (InJSON === "file:" + LockFile.pkgs[pkg].resolve) {
        InDevModePackages.push({
          n: ParsedInfo.FullPackageName,
          v: InJSON,
          ds: LockFile.pkgs[pkg].dependency_scope,
        });
      }
    }
    if (InDevModePackages.length > 0) {
      const msg =
        InDevModePackages.length +
        " " +
        ((InDevModePackages.length > 1 && "dependencies are") ||
          "dependency is") +
        ` using local registry files.\n\n${InDevModePackages.map(
          (x) => `${x.n} => ${x.v} | ${pluralize(x.ds, 1)}`
        ).join("\n")}`;
      if (Options.error) {
        logreport.error(msg);
        return;
      }
      if (Options.warn) {
        logreport.warn(msg);
        return;
      }
      await prompt<{ run_safe: boolean }>({
        name: "run_safe",
        initial: true,
        message: msg + "\n\nShould we prepare for production?",
        type: "confirm",
      })
        .then(async (res) => {
          if (res.run_safe) {
            await this.Prepare(false, { production: true });
            logreport(
              "Run `lpm prepare --development` when you finish publishing/pushing your package to switch back to local registry dependencies.",
              "log",
              true
            );
          } else {
            logreport.error(
              "Package not ready for production. run `lpm prepare --production`"
            );
          }
        })
        .catch((err) => {
          logreport.error(
            "Package not ready for production. run `lpm prepare --production`\n\n" +
              err
          );
        });
    } else {
      logreport(
        "Your package 📦 is already ready for production 🚀",
        "log",
        true
      );
    }
  }
  build(program: typeof CommanderProgram) {
    program
      .command("prepare")
      .description("Updates dependencies to fit that target build.")
      .option("-p, --production", "Prepare for production.")
      .option("-d, --dev", "Prepare for dev.")
      .action((options) => {
        this.Prepare(false, options);
      })
      .command("safe-production")
      .option(
        "-w, --warn [boolean]",
        "Warn if local registry dependencies are being used instead of prompting for change."
      )
      .option(
        "-e, --error [boolean]",
        "Error if local registry dependencies are being used instead of prompting for change."
      )
      .description(
        "Makes sure that no development dependencies are in package.json, if there's any it prompt to prepare for production."
      )
      .action(async (options) => {
        await this.Prepare(
          true,
          {
            safeproductionWarn: options.warn,
            safeproductionError: options.error,
          },
          process.cwd()
        );
        // await this.safeprod(process.cwd(), options);
      });
  }
}
