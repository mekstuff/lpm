import { Console } from "@mekstuff/logreport";
import { program as CommanderProgram } from "commander";
import { ParsePackageName, ReadPackageJSON } from "../utils/PackageReader.js";
import {
  ReadLPMPackagesJSON,
  ResolvePackageFromLPMJSONFromDirectory,
} from "../utils/lpmfiles.js";
import { getcommand } from "../lpm.js";
export default class push {
  async Push(
    cwd: string,
    CaptureNotPublished: boolean | undefined,
    options: { latest?: boolean },
    alreadyPushedDirectories?: Map<string, boolean>
  ) {
    const PackageJSON = await ReadPackageJSON(cwd);
    if (!PackageJSON.success || typeof PackageJSON.result === "string") {
      Console.error("Could not read package. => " + PackageJSON.result);
      process.exit(1);
    }
    const name = PackageJSON.result.name;
    if (!name) {
      Console.error("Package does not have a name.");
      process.exit(1);
    }

    const LPMPackagesJSON = await ReadLPMPackagesJSON();
    const ParsedName = ParsePackageName(name, PackageJSON.result.version);
    const pkg = LPMPackagesJSON.packages[ParsedName.FullResolvedName];

    if (!pkg) {
      if (CaptureNotPublished) {
        return;
      }
      Console.error(`${name} is not published.`);
      process.exit(1);
    }
    alreadyPushedDirectories = alreadyPushedDirectories ?? new Map();
    for (const i of pkg.installations) {
      if (alreadyPushedDirectories.get(i.path)) {
        continue;
      }
      alreadyPushedDirectories.set(i.path, true);
      await getcommand("upgrade").Upgrade([name], i.path, {
        includeSkip: true,
        latest: options.latest,
      });
      const Published = await ResolvePackageFromLPMJSONFromDirectory(i.path);
      if (Published) {
        await getcommand("publish").Publish(i.path, {
          scripts: false,
          silent: true,
        });
        await this.Push(
          i.path,
          CaptureNotPublished,
          options,
          alreadyPushedDirectories
        );
      }
    }
  }
  build(program: typeof CommanderProgram) {
    program
      .command("push [cwd]")
      .description("Runs upgrade on installed directories")
      .option("--latest", "Upgrades to the latest version without prompting.")
      .action((cwd, options) => {
        this.Push(cwd || process.cwd(), true, options);
      });
  }
}
