/* eslint-disable @typescript-eslint/no-explicit-any */
import chalk from "chalk";
import DraftLog from "draftlog";
/**
 * Trigger interval instantly
 */
export function setInstantInterval(callback, ms) {
    callback();
    return setInterval(callback, ms);
}
/**
 * Setup draftlog
 */
DraftLog(console);
/**
 * A custom draftlog object that appends prefixes for continual logging.
 */
const createCustomConsoleDraft = (useDrafter, prefixText) => {
    return (message, ...optionalParams) => {
        const msg = (prefixText ? prefixText : "") + message;
        useDrafter(msg, ...optionalParams);
        return createCustomConsoleDraft(useDrafter, prefixText);
    };
};
const Console = {
    // Core
    LOG(message, ...optionalParams) {
        return this.util.createDrafterWithPrefix(undefined, `${message}`, ...optionalParams);
    },
    log(message, ...optionalParams) {
        return this.util.createDrafterWithPrefix(`${this.util.getPrefixFromLogType("log")}: `, message, ...optionalParams);
    },
    info(message, ...optionalParams) {
        return this.util.createDrafterWithPrefix(`${this.util.getPrefixFromLogType("info")}: `, message, ...optionalParams);
    },
    VERBOSE(message, ...optionalParams) {
        //if process.argv is not specified, then consider verbose flag set in cases of running logreport in different environments maybe?...
        const VERBOSE_FLAG_SPECIFIED = process.argv
            ? process.argv.indexOf(this.util.VERBOSE_FLAG) !== -1
                ? true
                : false
            : true;
        if (VERBOSE_FLAG_SPECIFIED) {
            return this.util.createDrafterWithPrefix(`${this.util.getPrefixFromLogType("VERBOSE")}: `, message, ...optionalParams);
        }
        else {
            //Create a fake consoleDraft, if the verbose was to be called, then trigger real draft..
            return (message2, ...optionalParams2) => {
                return this.util.createDrafterWithPrefix(`${this.util.getPrefixFromLogType("VERBOSE")}: `, message2, ...optionalParams2);
            };
        }
    },
    warn(message, ...optionalParams) {
        return this.util.createDrafterWithPrefix(`${this.util.getPrefixFromLogType("warn")}: `, message, ...optionalParams);
    },
    error(message, dontExitProcess, ...optionalParams) {
        let mustExitProcess;
        if (dontExitProcess === undefined) {
            mustExitProcess = true;
        }
        else {
            mustExitProcess = !dontExitProcess;
        }
        const drafter = this.util.createDrafterWithPrefix(`${this.util.getPrefixFromLogType("error")}: `, message, ...optionalParams);
        if (mustExitProcess === true) {
            process.exit(1);
        }
        else {
            return drafter;
        }
    },
    assert(condition, message, dontExitProcess, ...optionalParams) {
        if (!condition) {
            return this.error(message, dontExitProcess, ...optionalParams);
        }
    },
    // Progress displays
    progress: {
        bar() {
            let update;
            function getProgressString(progress, helperMessage) {
                const units = Math.round(progress / 2);
                let res = "[" +
                    "=".repeat(units) +
                    " ".repeat(50 - units) +
                    "] " +
                    progress +
                    "%";
                if (helperMessage) {
                    res += " " + helperMessage;
                }
                return res;
            }
            let currentProgress = 0;
            let lerp_interval;
            return (progress, helperMessage, smooth) => {
                if (update === undefined) {
                    update = Console.LOG("");
                }
                if (lerp_interval) {
                    clearInterval(lerp_interval);
                    lerp_interval = undefined;
                }
                if (progress > 100) {
                    return;
                }
                const diff = progress - currentProgress;
                let targetProgress = currentProgress;
                if (smooth && Math.abs(diff) > 10) {
                    lerp_interval = setInstantInterval(() => {
                        if (targetProgress >= progress) {
                            if (lerp_interval) {
                                clearInterval(lerp_interval);
                                lerp_interval = undefined;
                            }
                            return;
                        }
                        if (diff > 0) {
                            targetProgress++;
                        }
                        else {
                            targetProgress--;
                        }
                        update(getProgressString(targetProgress, helperMessage));
                    }, 0.001);
                }
                else {
                    currentProgress = progress;
                    update(getProgressString(progress, helperMessage));
                }
            };
        },
        spinner(customFrames, text, customIntervals) {
            let frames;
            let interval = customIntervals || 80;
            if (typeof customFrames === "string") {
                let t = cli_spinners[customFrames];
                if (!t) {
                    t = cli_spinners["dots"];
                }
                frames = t.frames;
                interval = t.interval;
            }
            else if (Array.isArray(customFrames)) {
                frames = customFrames;
                interval = customIntervals || 80;
            }
            else {
                frames = cli_spinners["dots"].frames;
                interval = cli_spinners["dots"].interval;
            }
            let update;
            let SpinnerText = text;
            let intervalID;
            return {
                start(spinnerColor) {
                    if (update === undefined) {
                        update = Console.LOG("");
                    }
                    this.stop();
                    let i = 0;
                    intervalID = setInstantInterval(() => {
                        i = i + 1 === frames.length ? 0 : i + 1;
                        const frame = spinnerColor
                            ? chalk[spinnerColor](frames[i])
                            : frames[i];
                        const str = `${frame}${SpinnerText ? " " + SpinnerText : ""}`;
                        update(str);
                    }, interval);
                },
                stop(resetFrame) {
                    if (intervalID) {
                        clearTimeout(intervalID);
                        intervalID = undefined;
                    }
                    if (resetFrame) {
                        update(`${SpinnerText ? SpinnerText : ""}`);
                    }
                    return;
                },
                text(text) {
                    SpinnerText = text;
                },
                spinners: cli_spinners,
            };
        },
    },
    // Utilities
    util: {
        VERBOSE_FLAG: "--verbose",
        createDrafterWithPrefix(prefixText, ...initialMessage) {
            const drafter = console.draft((prefixText || "") + (initialMessage[0] || ""), ...initialMessage.splice(1));
            return createCustomConsoleDraft(drafter, prefixText);
        },
        getPrefixFromLogType(logType) {
            if (logType === "VERBOSE") {
                return chalk.gray("VERBOSE");
            }
            else if (logType === "error") {
                return chalk.redBright("ERROR");
            }
            else if (logType === "info") {
                return chalk.blueBright("INFO");
            }
            else if (logType === "log") {
                return chalk.gray("LOG");
            }
            else if (logType === "warn") {
                return chalk.yellow("WARN");
            }
            return "";
        },
    },
};
// Stepper
const LogSteps = (Steps, showIndex) => {
    let currentStep = 0;
    let currentSpinner;
    let ended = false;
    return {
        step: () => {
            if (currentSpinner) {
                currentSpinner.stop(true);
                currentSpinner = undefined;
            }
            let str = Steps[currentStep];
            if (str === undefined) {
                if (!ended) {
                    ended = true;
                }
                else {
                    Console.warn(`No more steps.`);
                }
                return;
            }
            if (showIndex) {
                str = `[${currentStep + 1}/${Steps.length}] ${str}`;
            }
            const Spinner = Console.progress.spinner(undefined, str);
            Spinner.start();
            currentStep++;
            currentSpinner = Spinner;
        },
    };
};
export { Console, LogSteps };
// Some spinners from https://github.com/sindresorhus/cli-spinners/blob/HEAD/spinners.json
const cli_spinners = {
    dots: {
        interval: 80,
        frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    },
    dots2: {
        interval: 80,
        frames: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
    },
    dots3: {
        interval: 80,
        frames: ["⠋", "⠙", "⠚", "⠞", "⠖", "⠦", "⠴", "⠲", "⠳", "⠓"],
    },
    line: {
        interval: 130,
        frames: ["-", "\\", "|", "/"],
    },
    simpleDots: {
        interval: 400,
        frames: [".  ", ".. ", "...", "   "],
    },
    simpleDotsScrolling: {
        interval: 200,
        frames: [".  ", ".. ", "...", " ..", "  .", "   "],
    },
    clock: {
        interval: 100,
        frames: [
            "🕛 ",
            "🕐 ",
            "🕑 ",
            "🕒 ",
            "🕓 ",
            "🕔 ",
            "🕕 ",
            "🕖 ",
            "🕗 ",
            "🕘 ",
            "🕙 ",
            "🕚 ",
        ],
    },
    material: {
        interval: 17,
        frames: [
            "█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "███▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "████▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "██████▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "██████▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "███████▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "████████▁▁▁▁▁▁▁▁▁▁▁▁",
            "█████████▁▁▁▁▁▁▁▁▁▁▁",
            "█████████▁▁▁▁▁▁▁▁▁▁▁",
            "██████████▁▁▁▁▁▁▁▁▁▁",
            "███████████▁▁▁▁▁▁▁▁▁",
            "█████████████▁▁▁▁▁▁▁",
            "██████████████▁▁▁▁▁▁",
            "██████████████▁▁▁▁▁▁",
            "▁██████████████▁▁▁▁▁",
            "▁██████████████▁▁▁▁▁",
            "▁██████████████▁▁▁▁▁",
            "▁▁██████████████▁▁▁▁",
            "▁▁▁██████████████▁▁▁",
            "▁▁▁▁█████████████▁▁▁",
            "▁▁▁▁██████████████▁▁",
            "▁▁▁▁██████████████▁▁",
            "▁▁▁▁▁██████████████▁",
            "▁▁▁▁▁██████████████▁",
            "▁▁▁▁▁██████████████▁",
            "▁▁▁▁▁▁██████████████",
            "▁▁▁▁▁▁██████████████",
            "▁▁▁▁▁▁▁█████████████",
            "▁▁▁▁▁▁▁█████████████",
            "▁▁▁▁▁▁▁▁████████████",
            "▁▁▁▁▁▁▁▁████████████",
            "▁▁▁▁▁▁▁▁▁███████████",
            "▁▁▁▁▁▁▁▁▁███████████",
            "▁▁▁▁▁▁▁▁▁▁██████████",
            "▁▁▁▁▁▁▁▁▁▁██████████",
            "▁▁▁▁▁▁▁▁▁▁▁▁████████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁███████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁██████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████",
            "█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████",
            "██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
            "██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
            "███▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
            "████▁▁▁▁▁▁▁▁▁▁▁▁▁▁██",
            "█████▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
            "█████▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
            "██████▁▁▁▁▁▁▁▁▁▁▁▁▁█",
            "████████▁▁▁▁▁▁▁▁▁▁▁▁",
            "█████████▁▁▁▁▁▁▁▁▁▁▁",
            "█████████▁▁▁▁▁▁▁▁▁▁▁",
            "█████████▁▁▁▁▁▁▁▁▁▁▁",
            "█████████▁▁▁▁▁▁▁▁▁▁▁",
            "███████████▁▁▁▁▁▁▁▁▁",
            "████████████▁▁▁▁▁▁▁▁",
            "████████████▁▁▁▁▁▁▁▁",
            "██████████████▁▁▁▁▁▁",
            "██████████████▁▁▁▁▁▁",
            "▁██████████████▁▁▁▁▁",
            "▁██████████████▁▁▁▁▁",
            "▁▁▁█████████████▁▁▁▁",
            "▁▁▁▁▁████████████▁▁▁",
            "▁▁▁▁▁████████████▁▁▁",
            "▁▁▁▁▁▁███████████▁▁▁",
            "▁▁▁▁▁▁▁▁█████████▁▁▁",
            "▁▁▁▁▁▁▁▁█████████▁▁▁",
            "▁▁▁▁▁▁▁▁▁█████████▁▁",
            "▁▁▁▁▁▁▁▁▁█████████▁▁",
            "▁▁▁▁▁▁▁▁▁▁█████████▁",
            "▁▁▁▁▁▁▁▁▁▁▁████████▁",
            "▁▁▁▁▁▁▁▁▁▁▁████████▁",
            "▁▁▁▁▁▁▁▁▁▁▁▁███████▁",
            "▁▁▁▁▁▁▁▁▁▁▁▁███████▁",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁███████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁███████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
            "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
        ],
    },
    bouncingBar: {
        interval: 80,
        frames: [
            "[    ]",
            "[=   ]",
            "[==  ]",
            "[=== ]",
            "[ ===]",
            "[  ==]",
            "[   =]",
            "[    ]",
            "[   =]",
            "[  ==]",
            "[ ===]",
            "[====]",
            "[=== ]",
            "[==  ]",
            "[=   ]",
        ],
    },
};
//# sourceMappingURL=index.js.map