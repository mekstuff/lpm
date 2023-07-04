import fs from "fs";
import path from "path";
import { program as CommanderProgram } from "commander";
import logreport from "../utils/logreport.js";
import enqpkg from "enquirer";
import chalk from "chalk";
const { prompt } = enqpkg;

export default class hook {
  gitdir = path.join(process.cwd(), ".git");
  githooksdir = path.join(this.gitdir, "hooks");
  gitprepushhookdir = path.join(this.githooksdir, "pre-push");

  MustHaveGitInitialized() {
    const gitdirExists = fs.existsSync(this.gitdir);
    if (!gitdirExists) {
      logreport.warn(
        "git is not initialized in the current directory, cannot hook. run `git init` first."
      );

      return;
    }
  }

  async unhookgit() {
    try {
      this.MustHaveGitInitialized();
      if (!fs.existsSync(this.gitprepushhookdir)) {
        logreport.warn(
          "no `pre-push` hook was found.\n" +
            path.relative(process.cwd(), this.gitprepushhookdir)
        );
        return;
      }
      const e = await prompt<{ confirm_proceed: boolean }>({
        name: "confirm_proceed",
        type: "confirm",
        message:
          "unhook git will remove any `pre-push` script whether or not it was created by lpm. Proceed?\n\n" +
          this.gitprepushhookdir,
      });
      if (e.confirm_proceed === true) {
        fs.rmSync(this.gitprepushhookdir);
        logreport("git unhooked 👍", "log", true);
      }
    } catch (err) {
      logreport.warn("Something went wrong when trying to unhook git " + err);
    }
  }
  async hookregistry() {
    logreport(
      "\nAdd the following source to your package.json 'prepublishOnly' script file\n\n" +
        chalk.gray("lpm prepare safe-production")
    );
  }
  async hookgit() {
    logreport(
      "\nAdd the following source to your .git/hooks/pre-push || .git/hooks/pre-push.sample (Will need to remove .sample ext) file\n\n" +
        GIT_PRE_PUSH_SOURCE
    );
  }

  build(program: typeof CommanderProgram) {
    const hookprogram = program
      .command("hook")
      .description(
        "Setup hooks for git and npm. Hooks help prepare the state of your package so you never publish with locally defined dependencies."
      )
      .action(() => {
        console.log("\n" + chalk.red("Hook git:"));
        this.hookgit();
        console.log(chalk.red("Hook registry:"));
        this.hookregistry();
      });

    hookprogram
      .command("git")
      .description(
        "setup git hooks so you never push to repository with locally defined dependencies."
      )
      .action(() => {
        this.hookgit();
      });

    hookprogram
      .command("registry")
      .description(
        "setup package so you never release a package with locally defined dependencies."
      )
      .action(() => {
        this.hookregistry();
      });
  }
}

//sources
const GIT_PRE_PUSH_SOURCE = chalk.gray(`#!/bin/sh

exec < /dev/tty
echo "lpm hook: git pre-push" # Log user
lpm prepare safe-production # (add -e || -w flags to not prompt)

# You can add your custom pre-push script from here...

exit 0
`);
