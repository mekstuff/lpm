/// <reference types="node" resolution-mode="require"/>
import { Color as chalkColor } from "chalk";
/**
 * Trigger interval instantly
 */
export declare function setInstantInterval(callback: () => void, ms?: number): NodeJS.Timer;
type consoleDraft = (message?: any, ...optionalParams: any[]) => void;
export type Spinner = ReturnType<Console["progress"]["spinner"]>;
type Console = {
    /**
     * Logs message without any prefix attached
     */
    LOG: (message: any, ...optionalParams: any[]) => consoleDraft;
    /**
     * Logs a message with a colored `LOG: ` prefix at the start
     */
    log: (message: any, ...optionalParams: any[]) => consoleDraft;
    /**
     * Logs a message with a colored `INFO: ` prefix at the start
     */
    info: (message: any, ...optionalParams: any[]) => consoleDraft;
    /**
     * Logs a message with a colored `WARN: ` prefix at the start
     */
    warn: (message: any, ...optionalParams: any[]) => consoleDraft;
    /**
     * Logs a message with a colored `VERBOSE: ` prefix at the start.
     *
     * if no --verbose flag is found in the process args, the log message
     * will not be displated.
     */
    VERBOSE: (message: any, ...optionalParams: any[]) => consoleDraft;
    /**
     * Logs a message with a colored `ERROR: ` prefix at the start.
     *
     * @param [dontExitProcess = true] set whether to automatically exist the process with a 1 exit code.
     */
    error: <TdontExitProcess extends boolean | undefined = false>(message: any, dontExitProcess?: TdontExitProcess, ...optionalParams: any[]) => TdontExitProcess extends true ? consoleDraft : never;
    /**
     If the condition is not met, an error message will be thrown.
    */
    assert: <TdontExitProcess extends boolean | undefined = true>(condition: any, message: any, dontExitProcess?: TdontExitProcess, ...optionalParams: any[]) => TdontExitProcess extends true ? consoleDraft : never;
    /**
     * For displaying progressive information
     */
    progress: {
        /**
         * A progressbar to display percentage.
         *
         * @param smooth will lerp from current value to new progress value in cases of big leaps. e.g 10% to 30%
         */
        bar: () => (progress: number, helperMessage?: any, smooth?: boolean) => void;
        /**
         * A `spinner/loader` to display yielding.
         *
         * @param frames an array of frames or the name of a currently supported spinner.
         * @param text optionally display a message next to the spinner.
         * @param intervals if frames are custom, you need to specify the interval speed. built spinners will automatically use their required intervals.
         */
        spinner: <TFrames extends string[] | cli_spinner>(frames?: TFrames, text?: any, interval?: TFrames extends string[] ? number : never) => {
            /**
             * Starts the spinner animation
             *
             * @param spinnerColor a custom chalk color for the spinner.
             */
            start: (spinnerColor?: typeof chalkColor) => void;
            /**
             * Stops the spinner animation
             */
            stop: (resetFrame?: boolean) => void;
            /**
             * Update the current spinner text
             */
            text: (text: any) => void;
            /**
             * Built in spinners.
             */
            spinners: typeof cli_spinners;
        };
    };
    /**
     * Utility functions
     */
    util: {
        /**
         * `Console.VERBOSE` will look for this flag, if exists then log will be shown. if not log will be hidden.
         */
        VERBOSE_FLAG: string;
        /**
         * Returns a chalked text with the given logtype
         */
        createDrafterWithPrefix: (prefixText?: string, initialMessage?: any, ...optionalParams: any[]) => consoleDraft;
        /**
         * Gets the prefix string based off log type.
         */
        getPrefixFromLogType: (logType: "warn" | "error" | "log" | "info" | "VERBOSE" | "") => string;
    };
};
declare const Console: Console;
declare const LogSteps: (Steps: string[], showIndex?: boolean) => {
    step: () => void;
};
export { Console, LogSteps };
declare const cli_spinners: {
    dots: {
        interval: number;
        frames: string[];
    };
    dots2: {
        interval: number;
        frames: string[];
    };
    dots3: {
        interval: number;
        frames: string[];
    };
    line: {
        interval: number;
        frames: string[];
    };
    simpleDots: {
        interval: number;
        frames: string[];
    };
    simpleDotsScrolling: {
        interval: number;
        frames: string[];
    };
    clock: {
        interval: number;
        frames: string[];
    };
    material: {
        interval: number;
        frames: string[];
    };
    bouncingBar: {
        interval: number;
        frames: string[];
    };
};
type cli_spinner = keyof typeof cli_spinners;
