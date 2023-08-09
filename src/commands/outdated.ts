// import LogReport from "@mekstuff/logreport";
// import { program as CommanderProgram } from "commander";
// import enqpkg from "enquirer";
// import { ReadLPMPackagesJSON, ReadLockFileFromCwd } from "../utils/lpmfiles.js";
// import { ReadPackageJSON } from "../utils/PackageReader.js";
// import chalk from "chalk";
// import { execSync } from "child_process";
// const { prompt } = enqpkg;

export default class outdated {
  build() {
    return;
  }
}
/*
export default class outdated {
  async Outdated(TargetPackage?: string) {
    const res = await prompt<{
      specific_package: string;
    }>({
      name: "specific_package",
      message: "Get outdated packages for a specific package?",
      type: "input",
      skip: TargetPackage ? true : false,
    }).catch((e) => {
      LogReport.error(e);
      process.exit(1);
    });
    const packages = (await ReadLPMPackagesJSON()).packages;

    type OUTDATEDLIST = { name: string; path: string }[];

    const HandlePackage = async (pkgName: string) => {
      const pkg = packages[pkgName];
      if (!pkg) {
        LogReport.error(`Package is not published "${pkgName}"`);
      }
      const OUTDATED: OUTDATEDLIST = [];
      for (const installation of pkg.installations) {
        const InstallationLOCK = await ReadLockFileFromCwd(
          installation.path,
          undefined,
          true
        );
        if (!InstallationLOCK) {
          // No lock file in the installation, prompt install?
          return;
        }
        const pkgJSON = await ReadPackageJSON(installation.path);
        if (!pkgJSON.success || typeof pkgJSON.result === "string") {
          LogReport.error(pkgJSON.result);
          process.exit(1);
        }
        const ExistsInLOCK = InstallationLOCK.pkgs[pkgName];
        if (
          (ExistsInLOCK && ExistsInLOCK.publish_sig !== pkg.publish_sig) ||
          !ExistsInLOCK
        ) {
          OUTDATED.push({
            name:
              pkgJSON.result.name ||
              "NO-NAME-SPECIFIED-IN-JSON => " + installation,
            path: installation.path,
          });
        }
      }
      if (OUTDATED.length <= 0) {
        LogReport(
          `${pkg.installations.length} installations of ${chalk.bold(
            pkgName
          )} are ${chalk.green("up to date.")}`,
          "info",
          true
        );
      } else {
        LogReport(
          `[${OUTDATED.length}/${
            pkg.installations.length
          }] installations of ${chalk.bold(pkgName)} are ${chalk.yellow(
            "outdated"
          )}`,
          "info",
          true
        );
        const runCommandOnAll = (command: string) => {
          for (const x of OUTDATED) {
            try {
              execSync(command, { cwd: x.path, stdio: "inherit" });
            } catch (e) {
              LogReport.warn(
                `Failed to run command "${command}" on "${x.name}", ${x.path}. ERR: ${e}`
              );
            }
          }
        };
        const promptFixOutdated = async () => {
          await prompt<{
            what_to_do:
              | "List"
              | "Update All"
              | "Run custom command on each installation";
          }>({
            name: "what_to_do",
            message: "What to do?",
            type: "select",
            choices: [
              "List",
              "Update All",
              "Run custom command on each installation",
            ],
          }).then(async (res) => {
            if (res.what_to_do === "List") {
              OUTDATED.map((x) => {
                console.log(x.name + " => " + x.path);
              });
              return promptFixOutdated();
            } else if (res.what_to_do === "Update All") {
              runCommandOnAll(`lpm pull ${pkgName}`);
            } else {
              await prompt<{ p: string }>({
                name: "p",
                message: "Set command",
                type: "input",
              })
                .then((res) => {
                  runCommandOnAll(res.p);
                })
                .catch((err) => {
                  LogReport.error(err);
                });
            }
          });
        };
        await promptFixOutdated();
      }
    };
    if (res.specific_package !== "") {
      await HandlePackage(res.specific_package);
    } else {
      for (const pkgName in packages) {
        await HandlePackage(pkgName);
        // console.log("\n");
      }
    }
  }
  build(program: typeof CommanderProgram) {
    program
      .command("outdated [targetPackage]")
      .action(async (targetPackage) => {
        await this.Outdated(targetPackage);
      });
  }
}
*/
