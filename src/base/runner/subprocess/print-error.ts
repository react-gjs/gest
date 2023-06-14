export const printError = (e: any) => {
  if (typeof e === "object" && e !== null) {
    if ("message" in e) {
      console.error(e.message, e.stack ?? "");
      return;
    }
  }

  console.error(String(e));
};
