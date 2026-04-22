/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
const levelsPriority: LevelsPriority = {
  debug: -1,
  verbose: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

function shouldLogDebug(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Determines whether a message with the specified log level should be logged
 * based on the current log level setting.
 *
 * @param currentLevel The current log level setting.
 * @param messageLevel The log level of the message to evaluate.
 *
 * @returns `true` if the message should be logged; otherwise, `false`.
 */

function shouldLogLevel(
  currentLevel: LogLevel,
  messageLevel: LogLevel
): boolean {
  if (messageLevel === "debug") {
    return shouldLogDebug();
  }

  return levelsPriority[messageLevel] >= levelsPriority[currentLevel];
}

const DefaultLogColors: LogColors = {
  levelInfo: (text: string) => `\u001b[34m${text}\u001b[0m`, // Blue
  levelWarn: (text: string) => `\u001b[33m${text}\u001b[0m`, // Yellow
  levelError: (text: string) => `\u001b[31m${text}\u001b[0m`, // Red
  message: (text: string) => text, // No color by default
  prefix: (text: string) => `\u001b[35m${text}\u001b[0m`, // Magenta
};

/**
 * Formats the provided log level string by applying the appropriate ascii color codes based on the log level.
 *
 * @param {LogLevel} level the log level
 *
 * @returns {string} the colored log level string
 */
function colorizeLogLevel(level: LogLevel): string {
  let style = (text: string) => text; // Default to no color

  switch (level) {
    case "info":
      style = DefaultLogColors.levelInfo;
      break;
    case "warn":
      style = DefaultLogColors.levelWarn;
      break;
    case "error":
      style = DefaultLogColors.levelError;
      break;
  }

  return style(level);
}

/**
 * Returns a string representation of the log prefix with the log level.
 *
 * @param {string} name the logger name
 * @param {LogLevel} level the log level
 * @param {boolean | LogPrefixFn} prefix the prefix option
 *
 * @returns {string} the formatted log prefix
 */
function stringifyPrefixWithLevel(
  name: string,
  level: LogLevel,
  prefix: boolean | LogPrefixFn
): string {
  const logLevel = `${colorizeLogLevel(level)}: `;

  if (!prefix) {
    return logLevel;
  }

  if (typeof prefix === "function") {
    return prefix(name, level);
  }

  return `[${DefaultLogColors.prefix(name)}] ${logLevel}`;
}

/**
 * Checks if the provided message contains ANSI color code symbols.
 *
 * @param {string} message the log message
 *
 * @returns {boolean} true if the message contains ANSI color codes, else false.
 */
function isAnsiColoredMessage(message: string): boolean {
  const ansiiRegex = /\\u001b\[\d+m/;

  if (ansiiRegex.test(message)) {
    console.log("Message is colored: ", message);
  }

  return ansiiRegex.test(message);
}

function coalesceLoggerOptions(options: LoggerOptions): LoggerOptions {
  const coercedLoggerOptions: LoggerOptions = {
    level: options?.level ?? "info",
    prefix: options?.prefix ?? true,
    colors: {
      levelInfo: options?.colors?.levelInfo ?? DefaultLogColors.levelInfo,
      levelWarn: options?.colors?.levelWarn ?? DefaultLogColors.levelWarn,
      levelError: options?.colors?.levelError ?? DefaultLogColors.levelError,
      message: options?.colors?.message ?? DefaultLogColors.message,
      prefix: options?.colors?.prefix ?? DefaultLogColors.prefix,
    },
    objectKeyModifier: options?.objectKeyModifier,
    objectValueModifier: options?.objectValueModifier,
    quoteStrings: options?.quoteStrings ?? false,
    sortObjectKeys: options?.sortObjectKeys ?? false,
  };
  return coercedLoggerOptions;
}

/**
 * Returns a function that logs messages of different levels prefixed with the logger name.
 *
 * @param name the log message prefix
 */
function createLogger(name: string, options: LoggerOptions): Logger {
  const coercedOptions = coalesceLoggerOptions(options);

  const createLogMessage: CreateLogMessageFn = (
    message: LogMessage,
    createOptions: CreateLogMessageOptions
  ) => {
    return prettyStringify(message, options)
      .split("\n")
      .map(
        (line) =>
          `${stringifyPrefixWithLevel(name, createOptions.level, createOptions.addPrefix)}${isAnsiColoredMessage(line) ? line : coercedOptions.colors.message(line)}`
      )
      .join("\n");
  };

  const logInfo = (...messageArgs: LogMessage[]) => {
    if (!shouldLogLevel(coercedOptions.level, "info")) {
      return;
    }

    /**
     * A message has multiple lines if at least one of the message arguments is a string that contains an escaped line break.
     * In this case, we split the message into lines and log each line separately.
     */
    const messageLines = messageArgs.flatMap((message) =>
      typeof message === "string" ? message.split("\n") : message
    );

    if (isMessageNewlineEscaped(messageArgs)) {
      for (const messageLine of messageLines) {
        console.log(
          createLogMessage(messageLine, {
            level: "info",
            addPrefix: coercedOptions.prefix,
          })
        );
      }
      return;
    }

    console.log(
      messageArgs
        .map((arg) =>
          createLogMessage(arg, {
            level: "info",
            addPrefix: coercedOptions.prefix,
          })
        )
        .join(" ")
    );
  };

  const logger: Logger = {
    name,
    options: coercedOptions,
    debug: (...messageArgs: LogMessage[]) => {
      // Only log debug messages in development mode, regardless of the log level setting
      if (process.env.NODE_ENV !== "development") {
        return;
      }

      console.debug(
        `${messageArgs.map((arg) => createLogMessage(arg, { level: "debug", addPrefix: coercedOptions.prefix })).join(" ")}`
      );
    },
    verbose: (...messageArgs: LogMessage[]) => {
      if (!shouldLogLevel(coercedOptions.level, "verbose")) {
        return;
      }

      console.log(
        `${messageArgs.map((arg) => createLogMessage(arg, { level: "verbose", addPrefix: coercedOptions.prefix })).join(" ")}`
      );
    },
    info: logInfo,
    next: logInfo,
    warn: (...messageArgs: LogMessage[]) => {
      if (!shouldLogLevel(coercedOptions.level, "warn")) {
        return;
      }

      console.warn(
        `${messageArgs.map((arg) => createLogMessage(arg, { level: "warn", addPrefix: coercedOptions.prefix })).join(" ")}`
      );
    },
    error: (...messageArgs: LogMessage[]) => {
      if (!shouldLogLevel(coercedOptions.level, "error")) {
        return;
      }

      console.error(
        `${messageArgs.map((arg) => createLogMessage(arg, { level: "error", addPrefix: coercedOptions.prefix })).join(" ")}`
      );
    },
    errorStack: (error: Error) => {
      console.error(
        `${stringifyPrefixWithLevel(name, "error", options.prefix)}${error.message}`
      );

      if (error.stack != null) {
        console.error(
          error.stack
            .split("\n")
            .map(
              (line) =>
                `${stringifyPrefixWithLevel(name, "error", options.prefix)}${line}`
            )
            .join("\n")
        );
      }
    },
    createLogMessage,
  };

  return logger;
}

/**
 * Checks if the provided log message contains an escaped newline character.
 *
 * @param {LogMessage[]} logMessage the log message
 *
 * @returns {boolean} true if the message contains an escaped newline character, else false.
 */
function isMessageNewlineEscaped(logMessage: LogMessage[]): boolean {
  return logMessage.some(
    (message) => typeof message === "string" && message.includes("\n")
  );
}
