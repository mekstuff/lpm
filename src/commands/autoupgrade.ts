import path from "path";
import chokidar from "chokidar";
import { program as CommanderProgram } from "commander";
import { GetLPMPackagesDirectory } from "../utils/lpmfiles.js";
import LogReport from "@mekstuff/logreport";
import { execSync } from "child_process";

export default class autoupgrade {
  async Autoupgrade(packages: string[], options: { command?: string }) {
    if (packages.length === 0) {
      LogReport.error(`Need atleast 1 package to watch.`);
      process.exit(1);
    }
    LogReport(
      `Auto upgrading ${packages.join(",")} when published.`,
      "log",
      true
    );
    const PackagesDir = await GetLPMPackagesDirectory();
    const RootDebounces: Map<string, number> = new Map();
    chokidar
      .watch(
        packages.map((x) => path.join(PackagesDir, x)),
        { ignoreInitial: true }
      )
      .on("all", (_, x) => {
        let rootTrigger: string | undefined;
        for (const f of packages) {
          const dir = path.join(PackagesDir, f);
          if (x.split(dir)[0] === "") {
            rootTrigger = f;
            break;
          }
        }
        if (rootTrigger) {
          const pt = RootDebounces.get(rootTrigger);
          if (pt !== undefined) {
            const cd = new Date();
            if (cd.getTime() - pt > 2000) {
              RootDebounces.set(rootTrigger, new Date().getTime());
            } else {
              return;
            }
          } else {
            RootDebounces.set(rootTrigger, new Date().getTime());
          }
          LogReport(`Upgrading ${rootTrigger}`, "log", true);
          execSync(`lpm`, { stdio: "inherit" });
          if (options.command) {
            execSync(options.command, { stdio: "inherit" });
          }
        }
      });
  }

  build(program: typeof CommanderProgram) {
    program
      .command("autoupgrade [packages...]")
      .option(
        "-c, --command <string>",
        "command to run after successful upgrade"
      )
      .action(async (packages, options) => {
        await this.Autoupgrade(packages, options);
      });
  }
}
