// type ValueOf<T> = T[keyof T];

export const SUPPORTED_PACKAGE_MANAGERS = ["yarn", "pnpm"];
// export type SUPPORTED_PACKAGE_MANAGERS = ValueOf<
//   typeof SUPPORTED_PACKAGE_MANAGERS
// >;
//npm is stored for typechecking but npm installs differently and is not supported so it will error in runtime, Plus it's slow.
export type SUPPORTED_PACKAGE_MANAGERS = "yarn" | "pnpm" | "npm";
