import { program as CommanderProgram } from "commander";
import { PromptSetLPMConfig } from "../utils/lpmconfig.js";

export default class config {
  build(program: typeof CommanderProgram) {
    program.command("config").action(async () => {
      await PromptSetLPMConfig();
    });
  }
}
