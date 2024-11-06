import { Mutex } from "@ncpa0cpl/mutex.js";
import GLib from "gi://GLib?version=2.0";
import type { ClientProxy } from "gjs-multiprocess";
import { ClientLocation, startServer } from "gjs-multiprocess";
import path from "path-gjsify";
import type { SuiteUpdateParams } from "../../progress/progress-utils/suite-progress";
import type { UnitProgressInitParams } from "../../progress/progress-utils/unit-progress";
import type { ConsoleInterceptor } from "../../utils/console-interceptor/console-interceptor";
import type * as worker from "./subprocess-runner";

declare global {
  interface MainProcessApi {
    testFinished(error?: any): void;
    testsFailed: () => void;
    suiteProgress: (progressUpdate: SuiteUpdateParams) => void;
    unitProgress: (progressUpdate: UnitProgressInitParams) => void;
    finish: (duration?: number) => void;
    sendLog: (type: keyof ConsoleInterceptor, data: any[]) => void;
  }
}

const filename = GLib.uri_parse(
  import.meta.url,
  GLib.UriFlags.NONE,
).get_path()!;
const dirname = path.dirname(filename);

ClientLocation.setClientLocation((dirname) =>
  path.resolve(dirname, "./esm/client.mjs"),
);

export class Multiprocessing {
  private static initMutex = new Mutex();
  private static server: Awaited<
    ReturnType<typeof startServer>
  > | null = null;
  private static workers = new Map<
    symbol,
    ClientProxy<typeof worker>
  >();

  private static async init() {
    this.server = await startServer("org.reactgjs.gest");
    return this.server;
  }

  private static async getServer() {
    await this.initMutex.acquire();
    try {
      return this.server ?? (await this.init());
    } finally {
      this.initMutex.release();
    }
  }

  public static async getWorker(id: symbol, api: MainProcessApi) {
    const server = await this.getServer();

    let worker = this.workers.get(id);

    if (!worker) {
      worker = await server.createClient(
        path.join(dirname, "subprocess-runner.mjs"),
        api,
      );
      this.workers.set(id, worker);
    }

    return worker;
  }

  public static async terminateWorker(id: symbol) {
    const worker = this.workers.get(id);
    if (worker) {
      await worker.terminate();
      this.workers.delete(id);
    }
  }

  public static async close() {
    await this.server?.close();
  }
}
