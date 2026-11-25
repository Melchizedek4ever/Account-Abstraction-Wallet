import { defineConfig } from "vitest/config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@stacks/clarinet-sdk/vitest";

// The clarinet environment gives every test a fresh simnet.
export default defineConfig({
  test: {
    environment: "clarinet",
    pool: "forks",
    isolate: false,
    maxWorkers: 1,
    setupFiles: [vitestSetupFilePath],
    environmentOptions: { clarinet: { ...getClarinetVitestsArgv() } },
  },
});
