import { Console } from "@mekstuff/logreport";
import { PackageFile } from "./PackageReader.js";
import { execSync } from "child_process";

type SupportedScripts = "prepack" | "prepublishOnly";

export default function runScriptsSync(
  path: string,
  packageJSON: PackageFile,
  targetScripts: Partial<SupportedScripts>[],
  scripts?: boolean
) {
  if (scripts === false) {
    return;
  }
  if (!packageJSON.scripts) {
    return;
  }
  const ScriptRunningLog = Console.log(`Running scripts...`);
  for (const x of targetScripts) {
    if (packageJSON.scripts[x]) {
      ScriptRunningLog(`Running "${packageJSON.name}" => "${x}"`);
      try {
        execSync(packageJSON.scripts[x], {
          cwd: path,
          stdio: "inherit",
        });
      } catch (err) {
        Console.error(`Failed on run script "${x}".`);
      }
    }
  }
}
