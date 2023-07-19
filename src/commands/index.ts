import * as add from "./add.js";
import * as remove from "./remove.js";
import * as publish from "./publish.js";
import * as unpublish from "./unpublish.js";

import * as list from "./list.js";

import * as prepare from "./prepare.js";

import * as hook from "./hook.js";

import * as backup from "./backup.js";

import * as watch from "./watch.js";

import * as bulk from "./bulk.js";

import * as runrelease from "./run-release.js";

import * as _import from "./import.js";
import * as _export from "./export.js";

const commands = {
  add,
  remove,
  publish,
  unpublish,
  list,
  prepare,
  hook,
  backup,
  watch,
  bulk,
  runrelease,
  _import,
  _export,
};

export default commands;
