export type BuildInfo = {
  commit: string;
  shortCommit: string;
  branch: string;
  builtBy: "workers-builds" | "local";
  dirty: boolean;
  builtAt: string;
};
