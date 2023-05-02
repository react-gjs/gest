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
        });

        const formatted = MarkupFormatter.format(markup);

        console.info("summary.info():\n\n", formatted);
      });
    });
  });
});
