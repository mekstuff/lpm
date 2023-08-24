import semver from "semver";
import { Console } from "@mekstuff/logreport";
import {
  ReadLPMPackagesJSON,
  ReadLockFileFromCwd,
  ResolvePackageFromLPMJSON,
} from "./lpmfiles.js";

export default async function LogOutdatedPackagesAtCwd(cwd: string) {
  const LPMPackagesJSON = await ReadLPMPackagesJSON();
  const LOCK = await ReadLockFileFromCwd(cwd, undefined, true);
  if (LOCK) {
    for (const pkg in LOCK.pkgs) {
      const CurrData = LOCK.pkgs[pkg];
      const PublishedData = await ResolvePackageFromLPMJSON(
        pkg,
        undefined,
        true
      );
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

      const inVersionTree =
        LPMPackagesJSON.version_tree[PublishedData.Parsed.FullPackageName];
      if (inVersionTree) {
        const latestCompatiableVersion = semver.maxSatisfying(
          inVersionTree,
          PublishedData.Parsed.VersionWithSymbol
        );
        if (latestCompatiableVersion !== PublishedData.Parsed.PackageVersion) {
          Console.warn(
            `${PublishedData.Parsed.FullPackageName}@${latestCompatiableVersion} is available, using ${pkg}`
          );
        }
      }
    }
  }
}
