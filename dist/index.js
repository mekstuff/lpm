#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Command } from "commander";
import commands from "./commands/index.js";
import { ReadLockFileFromCwd } from "./utils/lpmfiles.js";
const program = new Command();
const cmdClasses = new Map();
program
    .allowUnknownOption(true)
    .option("-pm, --package-manager [string]", "The package manager to use.")
    .option("--show-pm-logs", "Show package managers output in terminal.");
program.action((Options) => __awaiter(void 0, void 0, void 0, function* () {
    const Flags = [];
    process.argv.forEach((v, i) => {
        if (i > 1 && v.match("^-")) {
            Flags.push(v);
        }
    });
    if (Flags.length === 0 && process.argv.length > 2) {
        program.help();
        return;
    }
    const LockFile = yield ReadLockFileFromCwd();
    const pkgs = LockFile.pkgs;
    let ToCallInstall = [];
    for (const Package in pkgs) {
        ToCallInstall.push(Package);
    }
    ToCallInstall = [...ToCallInstall, ...Flags];
    getcommand("add").Add(ToCallInstall, Options);
    // execSync(`lpm add ${ToCallInstall.join(" ")}`)
}));
/**
 * Initializes the CLI.
 */
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        Object.entries(commands).forEach((object) => {
            const c = new object[1].default();
            c.build(program);
            cmdClasses.set(object[0], c);
        });
        program.parse();
    });
}
export function getcommand(command) {
    return cmdClasses.get(command);
}
init().catch((e) => {
    console.error("init failed ", e);
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map