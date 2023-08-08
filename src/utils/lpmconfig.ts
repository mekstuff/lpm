import fs from "fs";
import path from "path";
// import enqpkg from "enquirer";
// const { prompt } = enqpkg;
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Form } = require("enquirer");
import { GetLPMDirectory } from "./lpmfiles.js";
import LogReport from "@mekstuff/logreport";
import chalk from "chalk";

const ILPMConfigData = {
  ["maximum-local-pkgs-backups"]: "10",
};

type ILPMConfig = typeof ILPMConfigData;
export async function GetLPMConfigDirectory() {
  return path.join(await GetLPMDirectory(), ".config");
}

export async function ReadLPMConfig(): Promise<ILPMConfig> {
  const p = await GetLPMConfigDirectory();
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify({}, undefined, 2));
    return {} as ILPMConfig;
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as ILPMConfig;
}

export async function RequiresLPMConfigSet(
  targets: (keyof ILPMConfig)[],
  i?: number
): Promise<ILPMConfig> {
  const t = await ReadLPMConfig();
  const requiredbutnotset: typeof targets = [];
  for (const x of Object.values(targets)) {
    if (!t[x] || t[x] === "") {
      requiredbutnotset.push(x);
    }
  }
  if (requiredbutnotset.length > 0) {
    if (i === 2) {
      LogReport.error(
        `${requiredbutnotset.join()} is required to be configured.`
      );
    }
    await PromptSetLPMConfig(requiredbutnotset);
    return await RequiresLPMConfigSet(requiredbutnotset, i ? i + 1 : 1);
  }
  return await ReadLPMConfig();
}

export async function PromptSetLPMConfig(
  onlySpecificKeys?: (keyof ILPMConfig)[]
) {
  const ConfigDir = await GetLPMConfigDirectory();
  const CurrConfig = await ReadLPMConfig();
  const prompt = new Form({
    name: "configure",
    message: `Configure (${chalk.underline(ConfigDir)})`,
    choices: Object.keys(ILPMConfigData)
      .map((x) => {
        if (
          onlySpecificKeys &&
          onlySpecificKeys.indexOf(x as keyof ILPMConfig) === -1
        ) {
          return;
        } else {
          return {
            name: x,
            message: x,
            //@ts-expect-error tired when writing, can't be bothered to solve rn.
            initial: CurrConfig[x] || ILPMConfigData[x],
          };
        }
      })
      .filter((x) => x !== undefined),
  });
  await prompt
    .run()
    .then(async (x: ILPMConfig) => {
      fs.writeFileSync(ConfigDir, JSON.stringify(x, undefined, 2));
    })
    .catch((err: unknown) => {
      LogReport.warn(err);
    });
}
