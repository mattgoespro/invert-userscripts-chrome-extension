declare global {
  type LogMessage = unknown;

  type CreateLogMessageOptions = {
    level: LogLevel;
    addPrefix: boolean | LogPrefixFn;
  };

  type CreateLogMessageFn = (
    message: LogMessage,
    options?: CreateLogMessageOptions
  ) => string;

  type Logger = {
    name: string;
    options: LoggerOptions;
    info: (...messageArgs: LogMessage[]) => void;
    next: Logger["info"];
    verbose: (...messageArgs: LogMessage[]) => void;
    warn: (...messageArgs: LogMessage[]) => void;
    error: (...messageArgs: LogMessage[]) => void;
    debug: (...messageArgs: LogMessage[]) => void;
    errorStack: (error: Error) => void;
    createLogMessage: CreateLogMessageFn;
  };

  function createLogger(name: string, options?: LoggerOptions): Logger;

  type LevelsPriority = {
    debug: number;
    verbose: number;
    info: number;
    warn: number;
    error: number;
  };

  type LogLevel = keyof LevelsPriority;

  /**
   * A user-provided function option to format the logger prefix and level.
   *
   * @param name the logger name
   * @param level the log level
   * @returns the formatted prefix string
   */
  type LogPrefixFn = (loggerName: string, level: LogLevel) => string;

  type LogColors = {
    message: (text: string) => string;
    prefix: (text: string) => string;
    levelInfo: (text: string) => string;
    levelWarn: (text: string) => string;
    levelError: (text: string) => string;
  };

  type LoggerOptions = PrettyStringifyOptions & {
    level?: LogLevel;
    prefix?: boolean | LogPrefixFn;
    colors?: Partial<LogColors>;
  };
}

export {};
