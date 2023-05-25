import { OptionalField, Type, assertDataType } from "dilswer";
import Fs from "fs-gjs";
import { Global } from "../globals";
import { join } from "./path";

const PackageJsonSchema = Type.RecordOf({
  exports: OptionalField(
    Type.OneOf(
      Type.String,
      Type.Dict(
        Type.String,
        Type.RecordOf({
          default: OptionalField(Type.String),
          import: OptionalField(Type.String),
          node: OptionalField(Type.String),
          require: OptionalField(Type.String),
        })
      )
    )
  ),
  main: OptionalField(Type.String),
});

export const importModule = async <T>(module: string): Promise<T> => {
  const moduleParts = module.split("/");
  const scope = module.startsWith("@") ? moduleParts[0] : null;
  const packageName = (scope ? moduleParts[1] : moduleParts[0])!;
  const subPath = join(...moduleParts.slice(scope ? 2 : 1));

  const packageDir = join(
    Global.getCwd(),
    "node_modules",
    scope ? join(scope, packageName) : packageName
  );

  const hasPackageJson = await Fs.fileExists(join(packageDir, "package.json"));

  if (!hasPackageJson) {
    throw new Error(`Cannot locate module [${module}]`);
  }

  const packageJson: Record<string, any> = await Fs.readTextFile(
    join(packageDir, "package.json")
  ).then(JSON.parse);

  const getAbsPathForPackage = (relPath: string) => {
    return "file://" + join(packageDir, relPath);
  };

  assertDataType(PackageJsonSchema, packageJson);

  if (subPath === ".") {
    if (typeof packageJson.exports === "string") {
      const filePath = getAbsPathForPackage(packageJson.exports);
      return import(filePath);
    }

    if (packageJson.exports) {
      if ("." in packageJson.exports) {
        const exp = packageJson.exports["."];

        if (exp) {
          if (typeof exp === "string") {
            const filePath = getAbsPathForPackage(exp);
            return import(filePath);
          } else {
            if (exp.default) {
              const filePath = getAbsPathForPackage(exp.default);
              return import(filePath);
            }
            if (exp.import) {
              const filePath = getAbsPathForPackage(exp.import);
              return import(filePath);
            }
            if (exp.node) {
              const filePath = getAbsPathForPackage(exp.node);
              return import(filePath);
            }

            throw new Error(`Cannot locate module's [${module}] entrypoint`);
          }
        }
      }

      if (
        packageJson.exports.default &&
        typeof packageJson.exports.default === "string"
      ) {
        const filePath = getAbsPathForPackage(packageJson.exports.default);
        return import(filePath);
      }

      if (
        packageJson.exports.import &&
        typeof packageJson.exports.import === "string"
      ) {
        const filePath = getAbsPathForPackage(packageJson.exports.import);
        return import(filePath);
      }

      if (
        packageJson.exports.node &&
        typeof packageJson.exports.node === "string"
      ) {
        const filePath = getAbsPathForPackage(packageJson.exports.node);
        return import(filePath);
      }

      throw new Error(`Cannot locate module's [${module}] entrypoint`);
    }

    if (packageJson.main) {
      const filePath = getAbsPathForPackage(packageJson.main);
      return import(filePath);
    }

    throw new Error(`Cannot locate module's [${module}] entrypoint`);
  } else {
    if (packageJson.exports) {
      if (typeof packageJson.exports !== "string")
        if (`./${subPath}` in packageJson.exports) {
          const exp = packageJson.exports[`./${subPath}`];

          if (exp) {
            if (typeof exp === "string") {
              const filePath = getAbsPathForPackage(exp);
              return import(filePath);
            } else {
              if (exp.default) {
                const filePath = getAbsPathForPackage(exp.default);
                return import(filePath);
              }
              if (exp.import) {
                const filePath = getAbsPathForPackage(exp.import);
                return import(filePath);
              }
              if (exp.node) {
                const filePath = getAbsPathForPackage(exp.node);
                return import(filePath);
              }

              throw new Error(`Cannot locate module's [${module}] entrypoint`);
            }
          }
        }

      throw new Error(`Cannot locate module's [${module}] entrypoint`);
    }

    const filePath = getAbsPathForPackage(subPath);
    return import(filePath);
  }

  throw new Error(`Cannot locate module's [${module}] entrypoint`);
};
