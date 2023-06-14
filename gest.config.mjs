export default () => {
  /**
   * @type {import("@reactgjs/gest/config").Config}
   */
  const config = {
    testDir: "tests",
    srcDir: "src",
    parallel: 1,
    multiprocessing: false,
    errorReporterParser: (err, report) => {
      if (
        err instanceof Error &&
        err.message.includes("Invalid Markup.")
      ) {
        return report.message + "\n" + report.getPositionPatch();
      }
      return report.message;
    },
  };

  return config;
};
