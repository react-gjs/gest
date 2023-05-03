export default () => {
  /** @type {import("@reactgjs/gest/config").Config} */
  const config = {
    testDir: "tests",
    srcDir: "src",
    errorReporterParser: (err, report) => {
      if (err instanceof Error && err.message.includes("Invalid Markup.")) {
        return report.message + "\n" + report.getPositionPatch();
      }
      return report.message;
    },
  };

  return config;
};
