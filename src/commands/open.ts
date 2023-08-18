import { program as CommanderProgram } from "commander";
import { Console } from "@mekstuff/logreport";
import {
  GetLPMPackagesDirectory,
  GetLPMPackagesJSON,
} from "../utils/lpmfiles.js";
import { execSync } from "child_process";

const OPEN_REQS = ["json", "pkgs"] as const;
type OPEN_REQST = (typeof OPEN_REQS)[number];

export default class open {
  async OpenLPMJSON() {
    const LPMJSONPath = await GetLPMPackagesJSON();
    Console.log(LPMJSONPath);
    execSync(`start "" "${LPMJSONPath}"`);
  }
  async OpenLPMPackages() {
    const LPMPackagesDirectory = await GetLPMPackagesDirectory();
    Console.log(LPMPackagesDirectory);
    execSync(`start "" "${LPMPackagesDirectory}"`);
  }
  async Open(target: OPEN_REQST) {
    switch (target) {
      case "json":
        await this.OpenLPMJSON();
        return;
      case "pkgs":
        await this.OpenLPMPackages();
        return;
      default:
        Console.error(
          `Unknown open request "${target}". Try: ${OPEN_REQS.join(",")}`
        );
    }
  }
  build(program: typeof CommanderProgram) {
    program
      .command("open <target>")
      .description(OPEN_REQS.join("|"))
      .action(async (target) => {
        await this.Open(target);
      });
  }
}
