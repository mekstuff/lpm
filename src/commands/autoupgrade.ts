import path from "path";
import chokidar from "chokidar";
import { program as CommanderProgram } from "commander";
import {
  ReadLockFileFromCwd,
  SetUseLPMPackagesJSONMemory,
} from "../utils/lpmfiles.js";
import { Console } from "@mekstuff/logreport";
import { execSync } from "child_process";
import { ParsePackageName } from "../utils/PackageReader.js";
import { GetPublishTriggersDirectory } from "./publish.js";
import { getcommand } from "../lpm.js";

export default class autoupgrade {
  async Autoupgrade(
    packages: string[],
    options: { command?: string }
  ): Promise<void> {
    if (packages.length === 0) {
      const LOCK = await ReadLockFileFromCwd(process.cwd(), undefined, true);
      if (!LOCK) {
        Console.error(
          `${process.cwd()} does not have a LOCK file, could not get packages to run autoupgrade on`
        );
      }
      const t: typeof packages = [];
      for (const p in LOCK.pkgs) {
        const Parsed = ParsePackageName(p);
        t.push(Parsed.FullPackageName);
      }
      if (t.length === 0) {
        Console.error(`No packages are installed at "${process.cwd()}"`);
        process.exit(1);
      }
      return this.Autoupgrade(t, options);
    }
    // Console.info(`Auto upgrading ${packages.join(",")} when published.`);
    const PublishTriggersDir = await GetPublishTriggersDirectory();
    const RootDebounces: Map<string, number> = new Map();

    const runUpgrade = async (
      rootTrigger: string,
      dontRunCommand?: boolean,
      usePackageList?: string[]
    ) => {
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
      Console.info(`Upgrading ${rootTrigger}`);
      await getcommand("upgrade").Upgrade(
        usePackageList || [rootTrigger],
        process.cwd(),
        {
          latest: true,
        }
      );
      if (options.command && !dontRunCommand) {
        execSync(options.command, { stdio: "inherit" });
      }
    };

    await runUpgrade(`${packages.join(",")}`, true, packages);

    // since the watcher holds the command, the lpm package json file will be outdated before command finishes executing
    // prevents overwriting with old data.
    SetUseLPMPackagesJSONMemory(false);
    chokidar
      .watch(
        packages.map((x) => path.join(PublishTriggersDir, x)),
        { ignoreInitial: true }
      )
      .on("addDir", async (x) => {
        let rootTrigger: string | undefined;
        for (const f of packages) {
          const dir = path.join(PublishTriggersDir, f);
          if (x.split(dir)[0] === "") {
            rootTrigger = f;
            break;
          }
        }
        if (rootTrigger) {
          await runUpgrade(rootTrigger);
        }
      });
  }

  build(program: typeof CommanderProgram) {
    program
      .command("autoupgrade [packages...]")
      .description(
        "Automatically upgrade installed packages when they're published, you can specify packages that trigger an autoupgrade or pass no package to use all currently installed packages."
      )
      .option(
        "-c, --command <string>",
        "command to run after successful upgrade"
      )
      .action(async (packages, options) => {
        await this.Autoupgrade(packages, options);
      });
  }
}
