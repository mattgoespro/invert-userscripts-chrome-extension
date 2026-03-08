import webpack from "webpack";

type LogLevel = "INFO" | "WARN" | "ERROR" | "VERB";

export const createLogger = (name: string, options: { verbose?: boolean }) => {
  const Colors = webpack.cli.createColors();
  const loggerName = `${Colors.italic(Colors.cyan(name))} `;

  const getLevelColor = (level: LogLevel) => {
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

  const levelIndent = 5; // Pad log level to 5 characters for alignment

  const stringifyLevel = (level: LogLevel) =>
    Colors.bold(getLevelColor(level)(level.padEnd(levelIndent)));

  const stringifyMessage = (level: LogLevel, message: string) =>
    level === "VERB"
      ? Colors.italic(getLevelColor(level)(message))
      : getLevelColor(level)(message);

  const createMessage = (level: LogLevel, message: string) =>
    `${loggerName} ${stringifyLevel(level)} ${stringifyMessage(level, message)}`;

  const printMessage = (level: LogLevel, message: string) => {
    if (!message.includes("\n")) {
      console.log(createMessage(level, message));
      return;
    }

    const lines = message.split("\n");

    // trim off any empty lines at the start of the message
    while (lines.length > 0 && lines[0].trim() === "") {
      lines.shift();
    }

    // trim off any empty lines at the end of the message
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    for (const line of lines) {
      console.log(createMessage(level, line.trim()));
    }
    return;
  };

  return {
    info: (message: string) => {
      printMessage("INFO", message);
    },
    warn: (message: string) => {
      printMessage("WARN", message);
    },
    error: (message: string) => {
      printMessage("ERROR", message);
    },
    verbose: (message: string | object) => {
      if (!options.verbose) {
        return;
      }

      if (
        typeof message === "object" ||
        Object.getPrototypeOf(message) === Object.prototype
      ) {
        printMessage("VERB", JSON.stringify(message, null, 2));
        return;
      }

      printMessage("VERB", message);
    },
    createMessage: createMessage,
  };
};

export type Logger = ReturnType<typeof createLogger>;
