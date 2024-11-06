export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  __internal_serialized_error_instance: string;
};

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      ...error,
      name: error.name,
      message: error.message,
      stack: error.stack,
      __internal_serialized_error_instance: error.constructor.name,
    };
  }

  if (
    typeof error === "object" &&
    error != null &&
    isSerializedError(error)
  ) {
    return error;
  }

  return {
    name: "UnknownError",
    message: String(error),
    stack: "<unable to generate a stack trace>",
    __internal_serialized_error_instance: "none",
  };
};

export function isSerializedError(
  error: object,
): error is SerializedError {
  return "__internal_serialized_error_instance" in error;
}
