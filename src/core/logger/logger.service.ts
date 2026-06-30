import {
  Injectable,
  LoggerService as NestLoggerService,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  log(message: any, context?: string) {
    if (typeof message === 'object') {
      this.logger.info(JSON.stringify(message), { context });
    } else {
      this.logger.info(message, { context });
    }
  }

  error(message: any, trace?: string, context?: string) {
    if (typeof message === 'object') {
      this.logger.error(JSON.stringify(message), { trace, context });
    } else {
      this.logger.error(message, { trace, context });
    }
  }

  warn(message: any, context?: string) {
    if (typeof message === 'object') {
      this.logger.warn(JSON.stringify(message), { context });
    } else {
      this.logger.warn(message, { context });
    }
  }

  debug(message: any, context?: string) {
    if (typeof message === 'object') {
      this.logger.debug(JSON.stringify(message), { context });
    } else {
      this.logger.debug(message, { context });
    }
  }

  verbose(message: any, context?: string) {
    if (typeof message === 'object') {
      this.logger.verbose(JSON.stringify(message), { context });
    } else {
      this.logger.verbose(message, { context });
    }
  }
}
