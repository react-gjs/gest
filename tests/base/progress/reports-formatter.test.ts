import { describe, it } from "gest";
import { MarkupFormatter } from "termx-markup";
import { ReportsFormatter } from "../../../src/base/progress/reports-formatter";

export default describe("ReportsFormatter", () => {
  describe("should generate a valid markup", () => {
    describe("info", () => {
      it("summary", () => {
        const markup = ReportsFormatter.info.summary({
          failedSuites: 0,
          failedUnits: 1,
          passedSuites: 1,
          passedUnits: 0,
          skippedSuites: 0,
          skippedUnits: 3,
          totalDuration: 12769,
        });

        const formatted = MarkupFormatter.format(markup);

        console.info("info.summary():\n\n", formatted, "\n");
      });

      it("unitSkipped", () => {
        const markup = ReportsFormatter.info.unitSkipped([
          "some",
          "test",
          "foo",
        ]);

        const formatted = MarkupFormatter.format(markup);

        console.info("info.unitSkipped():\n", formatted, "\n");
      });

      it("unitPassed", () => {
        const markup = ReportsFormatter.info.unitPassed(
          ["some", "test", "bar"],
          69
        );

        const formatted = MarkupFormatter.format(markup);

        console.info("info.unitPassed():\n", formatted, "\n");
      });

      it("unitFailed", () => {
        const markup = ReportsFormatter.info.unitFailed([
          "some",
          "test",
          "baz",
        ]);

        const formatted = MarkupFormatter.format(markup);

        console.info("info.unitFailed():\n", formatted, "\n");
      });

      it("unitTimedOut", () => {
        const markup = ReportsFormatter.info.unitTimedOut([
          "some",
          "test",
          "qux",
        ]);

        const formatted = MarkupFormatter.format(markup);

        console.info("info.unitTimedOut():\n", formatted, "\n");
      });

      it("suiteSkipped", () => {
        const markup = ReportsFormatter.info.suiteSkipped("/home/owner/foo");

        const formatted = MarkupFormatter.format(markup);

        console.info("info.suiteSkipped():\n", formatted, "\n");
      });

      it("suitePassed", () => {
        const markup = ReportsFormatter.info.suitePassed("/home/owner/bar");

        const formatted = MarkupFormatter.format(markup);

        console.info("info.suitePassed():\n", formatted, "\n");
      });

      it("suiteFailed", () => {
        const markup = ReportsFormatter.info.suiteFailed("/home/owner/baz");

        const formatted = MarkupFormatter.format(markup);

        console.info("info.suiteFailed():\n", formatted, "\n");
      });
    });

    describe("error", () => {
      it("expectError", () => {
        const markup = ReportsFormatter.error.expectError(
          ["some", "test", "foo"],
          "/project/path/__test__/foo.test.ts",
          "Expect failed.",
          "1",
          "2"
        );

        const formatted = MarkupFormatter.format(markup);

        console.info("error.expectError():\n", formatted, "\n");
      });

      it("unableToStartSuite", () => {
        const markup = ReportsFormatter.error.unableToStartSuite(
          "/foo/bar/__test__/foo.test.ts",
          "Failed to start suite.",
          "at anonymous (/foo/bar/__test__/foo.test.ts:1:2)"
        );

        const formatted = MarkupFormatter.format(markup);

        console.info("error.unableToStartSuite():\n", formatted, "\n");
      });

      it("lifecycleHook", () => {
        const markup = ReportsFormatter.error.lifecycleHook(
          "/foo/bar/__test__/foo.test.ts:5:2",
          "Failed to run hook.",
          "at anonymous (/foo/bar/__test__/foo.test.ts:5:2)"
        );

        const formatted = MarkupFormatter.format(markup);

        console.info("error.lifecycleHook():\n", formatted, "\n");
      });

      it("unknownUnitError", () => {
        const markup = ReportsFormatter.error.unknownUnitError(
          ["some", "test", "foo"],
          "/project/path/__test__/foo.test.ts:15:4",
          "Failed to run unit.",
          "at anonymous (/project/path/__test__/foo.test.ts:30:4)\nat anonymous (/project/path/__test__/foo.test.ts:15:4)"
        );

        const formatted = MarkupFormatter.format(markup);

        console.info("error.unknownUnitError():\n", formatted, "\n");
      });

      it("unknownSuiteError", () => {
        const markup = ReportsFormatter.error.unknownSuiteError(
          "/project/path/__test__/foo.test.ts",
          "Failed to run suite.",
          "at anonymous (/project/path/__test__/foo.test.ts:30:4)\nat anonymous (/project/path/__test__/foo.test.ts:15:4)"
        );

        const formatted = MarkupFormatter.format(markup);

        console.info("error.unknownSuiteError():\n", formatted, "\n");
      });
    });
  });
});
