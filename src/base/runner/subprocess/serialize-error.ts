export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      ...error,
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
};
