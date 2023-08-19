import { Console } from "@mekstuff/logreport";
import { ReadLockFileFromCwd, ResolvePackageFromLPMJSON } from "./lpmfiles.js";

export default async function LogOutdatedPackagesAtCwd(cwd: string) {
  const LOCK = await ReadLockFileFromCwd(cwd, undefined, true);
  if (LOCK) {
    for (const pkg in LOCK.pkgs) {
      const CurrData = LOCK.pkgs[pkg];
      const PublishedData = await ResolvePackageFromLPMJSON(pkg);
      if (!PublishedData) {
        Console.warn(
          `${pkg} does not seemed to be published or could not be resolved.`
        );
        continue;
      }
      if (PublishedData.Package.publish_sig !== CurrData.publish_sig) {
        Console.warn(
          `${pkg} is using an outdated publish signature. using "${CurrData.publish_sig}" but "${PublishedData.Package.publish_sig}" is available.`
        );
      }
    }
  }
}
