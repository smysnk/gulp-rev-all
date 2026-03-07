type Colorizer = (value: unknown) => string;

function wrapAnsi(openCode: number, closeCode = 39): Colorizer {
  return (value) => {
    const text = String(value);

    if (!process.stdout.isTTY) {
      return text;
    }

    return `\u001b[${openCode}m${text}\u001b[${closeCode}m`;
  };
}

/**
 * Minimal internal color helper used for debug logging.
 *
 * The project previously relied on `chalk`, but that package is ESM-only and
 * breaks the CommonJS distribution path.
 */
const color = {
  blue: wrapAnsi(34),
  green: wrapAnsi(32),
  magenta: wrapAnsi(35),
  red: wrapAnsi(31),
};

export default color;
