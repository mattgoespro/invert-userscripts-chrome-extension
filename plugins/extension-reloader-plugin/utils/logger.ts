import webpack from "webpack";

type LogLevel = "INFO" | "WARN" | "ERROR" | "VERB";

export const createLogger = (name: string, options: { verbose?: boolean }) => {
  const Colors = webpack.cli.createColors();
  const loggerName = `${Colors.italic(Colors.cyan(name))} `;

  const padLevel = (level: LogLevel) => level.padEnd(5);

  const styleLevel = (level: LogLevel, color: (text: string) => string) =>
    Colors.bold(color(padLevel(level)));

  const createMessage = (level: LogLevel, message: string) =>
    `${loggerName} ${styleLevel(level, getColorFunction(level))} ${message}`;

  const getColorFunction = (level: LogLevel) => {
    switch (level) {
      case "INFO":
        return Colors.greenBright;
      case "WARN":
        return Colors.yellowBright;
      case "ERROR":
        return Colors.redBright;
      case "VERB":
        return Colors.gray;
      default:
        return Colors.white;
    }
  };

  return {
    info: (message: string) => {
      console.info(
        `${loggerName} ${styleLevel("INFO", Colors.green)} ${Colors.greenBright(message)}`
      );
    },
    warn: (message: string) => {
      console.warn(
        `${loggerName} ${styleLevel("WARN", Colors.yellow)} ${Colors.yellowBright(message)}`
      );
    },
    error: (message: string) => {
      console.error(
        `${loggerName} ${styleLevel("ERROR", Colors.red)} ${Colors.redBright(message)}`
      );
    },
    verbose: (message: string | object) => {
      if (!options.verbose) {
        return;
      }

      if (message && Object.getPrototypeOf(message) === Object.prototype) {
        console.info(Colors.gray(Colors.italic(JSON.stringify(message, null, 2))));
        return;
      }

      console.info(
        `${loggerName} ${styleLevel("VERB", Colors.gray)} ${Colors.gray(Colors.italic(message))}`
      );
    },
    createMessage,
  };
};

export type Logger = ReturnType<typeof createLogger>;
