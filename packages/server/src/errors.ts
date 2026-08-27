/** An error with an HTTP status + stable machine code, surfaced as `{error:{code,message}}`. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Spotify / auth is not connected — the caller should send the user through `/auth/login`. */
export class NotConnectedError extends AppError {
  constructor(message = "Spotify is not connected") {
    super("not_connected", message, 401);
  }
}
