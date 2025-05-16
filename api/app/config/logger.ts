import { createLogger, format } from "winston";
import Transport from "winston-transport";
import db from "./db";
import { logs } from "./schema";

class PostgresTransport extends Transport {
  constructor(opts: Transport.TransportStreamOptions) {
    super(opts);
  }

  async log(info: any, callback: any) {
    setImmediate(() => this.emit("logged", info));
    const { level, message, ...meta } = info;
    await db.insert(logs).values({
      level,
      message,
      meta,
      timestamp: new Date(),
    });
    callback();
  }
}

const logger = createLogger({
  level: "info",
  format: format.json(),
  transports: [
    new PostgresTransport({
      level: "info",
      format: format.json(),
    }),
  ],
});

export default logger;
