import { LogReport } from "@mekstuff/logreport";

export default LogReport;
// import chalk from "chalk";
// type logTypes = "log" | "warn" | "error" | "VERBOSE";

// /**
//  * Central area for writing to console.
//  * @param prefix adds prefix to log message, if prefix is true then prefix will be the logType.
//  */
// const logreport = (
//   logMessage: unknown,
//   logType?: logTypes,
//   prefix?: string | true
// ) => {
//   logType = logType || "log";
//   if (prefix === true) {
//     if (logType === "error") {
//       prefix = chalk.red("ERROR: ");
//     } else if (logType === "warn") {
//       prefix = chalk.yellow("WARN: ");
//     } else {
//       prefix = chalk.blueBright("INFO: ");
//     }
//   }
//   if (logType === "VERBOSE") {
//     return;
//   }
//   if (prefix) {
//     logMessage = prefix + logMessage;
//   }
//   if (logType === "warn") {
//     console.warn(logMessage);
//   } else if (logType === "error") {
//     console.error(logMessage);
//   } else {
//     console.log(logMessage);
//   }
// };

// export default logreport;

// const logwithelapse_ids = new Map<string, Date>();

// export function endelapse(
//   timeElapseId: string,
//   message?: string,
//   logType?: logTypes,
//   prefix?: string | true
// ) {
//   const mp = chalk.blue(timeElapseId + ": ");
//   if (logwithelapse_ids.get(timeElapseId)) {
//     logreport(
//       `${mp}${message || ""}✅ => ${chalk.green(
//         new Date().toLocaleTimeString()
//       )}`,
//       logType,
//       prefix
//     );

//     logwithelapse_ids.delete(timeElapseId);
//   }
// }

// /**
//  * Logs message with the time elapsed.
//  *
//  * @param timeElapseId Refers to the a unique id of the process, if the id exists it will log the time difference between the previous call time and the current time
//  */
// export function logwithelapse(
//   logMessage: unknown,
//   timeElapseId: string,
//   closeTimeElapse?: boolean,
//   logType?: logTypes,
//   prefix?: string | true
// ) {
//   const exists = logwithelapse_ids.get(timeElapseId);
//   const mp = chalk.blue(timeElapseId + ": ");
//   if (exists) {
//     const date = new Date();
//     const t = Math.floor(date.getTime() - exists.getTime());

//     logreport(
//       `${mp + logMessage} => ${chalk.green(t + "ms")}`,
//       logType,
//       prefix
//     );

//     if (closeTimeElapse) {
//       logreport(
//         `${mp}✅ => ${chalk.green(date.toLocaleTimeString())}`,
//         logType,
//         prefix
//       );
//     }
//   } else {
//     logreport(
//       `${mp + logMessage} =>  ${chalk.green(new Date().toLocaleTimeString())}`,
//       logType,
//       prefix
//     );
//   }
//   if (!closeTimeElapse) {
//     logwithelapse_ids.set(timeElapseId, new Date());
//   } else {
//     logwithelapse_ids.delete(timeElapseId);
//   }
// }

// logreport.assert = (
//   condition: boolean,
//   logMessage: unknown,
//   noProcessExit?: boolean,
//   logType?: logTypes,
//   prefix?: string
// ) => {
//   if (!condition) {
//     logreport.error(logMessage, noProcessExit, logType, prefix);
//     return false;
//   }
//   return true;
// };

// logreport.error = (
//   logMessage: unknown,
//   noProcessExit?: boolean,
//   logType?: logTypes,
//   prefix?: string
// ) => {
//   logreport(logMessage, logType || "error", prefix || true);
//   if (!noProcessExit) {
//     process.exit(1);
//   }
// };

// logreport.warn = (logMessage: unknown, logType?: logTypes, prefix?: string) => {
//   logreport(logMessage, logType || "warn", prefix || true);
// };

// logreport.logwithelapse = logwithelapse;
// logreport.endelapse = endelapse;
