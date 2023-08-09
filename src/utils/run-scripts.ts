import LogReport from "@mekstuff/logreport";
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
  for (const x of targetScripts) {
    if (packageJSON.scripts[x]) {
      LogReport(`Running "${packageJSON.name}" => "${x}"`, "log", true);
      try {
        execSync(packageJSON.scripts[x], {
          cwd: path,
          stdio: "inherit",
        });
      } catch (err) {
        LogReport.error(`Failed on run script "${x}".`);
      }
    }
  }
}
