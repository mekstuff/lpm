import { program as CommanderProgram } from "commander";
import logreport from "../utils/logreport.js";
import { ReadLockFileFromCwd } from "../utils/lpmfiles.js";
import { getcommand } from "../lpm.js";

export default class push {
  async Pull(targetPackage: string, options: { Log?: boolean; Cwd?: string }) {
    options.Cwd = options.Cwd || process.cwd();
    const LOCK = await ReadLockFileFromCwd(options.Cwd);
    const inLock = LOCK.pkgs[targetPackage];
    if (!inLock) {
      logreport.error(`${targetPackage} was not found in LOCK file.`);
      process.exit(1);
    }
    process.chdir(options.Cwd); //change to working directory when running add since it does not support cwd option.
    await getcommand("add").Add([targetPackage], { showPmLogs: options.Log });
  }
  build(program: typeof CommanderProgram) {
    program
      .command("pull <package>")
      .option("-log [boolean]", "Log command process.", false)
      .option("-cwd <string>", "Set the current working directory")
      .description("Updates the package with the currently published version.")
      .action(async (cwd, options) => {
        await this.Pull(cwd, options);
      });
  }
}
