/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/require-await */
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { OktaClient } from './types';
import { OktaIntegrationConfig } from '../types';

const okta = require('@okta/okta-sdk-nodejs');

const DEFAULT_MINIMUM_RATE_LIMIT_REMAINING = 5;

interface RequestExecutorWithEarlyRateLimitingOptions {
  minimumRateLimitRemaining?: number;
}

/**
 * A custom Okta request executor that throttles requests when `x-rate-limit-remaining` response
 * headers fall below a provided threshold.
 */
export class RequestExecutorWithEarlyRateLimiting extends okta.RequestExecutor {
  logger: IntegrationLogger;
  minimumRateLimitRemaining: number;
  requestAfter: number | undefined;

  constructor(
    logger: IntegrationLogger,
    options?: RequestExecutorWithEarlyRateLimitingOptions,
  ) {
    super();
    this.logger = logger;
    this.minimumRateLimitRemaining =
      options?.minimumRateLimitRemaining ||
      DEFAULT_MINIMUM_RATE_LIMIT_REMAINING;
  }

  async fetch(request: any) {
    const now = Date.now();
    if (this.getThrottleActivated()) {
      const delayMs = this.requestAfter! - now;
      this.forceSleep(delayMs);
    }
    return super.fetch(request).then((response: any) => {
      this.requestAfter = this.getRequestAfter(response);
      return response;
    });
  }

  getRateLimitReset(response: any) {
    return response.headers.get('x-rate-limit-reset');
  }

  getRateLimitRemaining(response: any) {
    return response.headers.get('x-rate-limit-remaining');
  }

  getRequestAfter(response: any) {
    const rateLimitRemaining = this.getRateLimitRemaining(response);
    if (rateLimitRemaining <= this.minimumRateLimitRemaining) {
      const requestAfter =
        new Date(
          parseInt(this.getRateLimitReset(response), 10) * 1000,
        ).getTime() + 1000;
      this.logger.info(
        {
          minimumRateLimitRemaining: this.minimumRateLimitRemaining,
          requestAfter,
          url: response.url,
        },
        'Minimum `x-rate-limit-remaining` header reached. Temporarily throttling requests',
      );
      return requestAfter;
    }
    return undefined;
  }

  delayRequests(delayMs: number) {
    const now = Date.now();
    this.requestAfter = now + delayMs;
  }

  getThrottleActivated() {
    const now = Date.now();
    return this.requestAfter && this.requestAfter > now;
  }

  forceSleep(milliseconds) {
    const date = Date.now();
    let currentDate = Date.now();
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
  }
}

export default function createOktaClient(
  logger: IntegrationLogger,
  config: OktaIntegrationConfig,
  options?: RequestExecutorWithEarlyRateLimitingOptions,
): OktaClient {
  const defaultRequestExecutor = new RequestExecutorWithEarlyRateLimiting(
    logger,
    options,
  );

  defaultRequestExecutor.on(
    'backoff',
    (request: any, response: any, requestId: any, delayMs: any) => {
      logger.info(
        {
          delayMs,
          requestId,
          url: request.url,
        },
        'Okta client backoff',
      );
    },
  );

  defaultRequestExecutor.on('resume', (request: any, requestId: any) => {
    logger.info(
      {
        requestId,
        url: request.url,
      },
      'Okta client resuming',
    );
  });

  defaultRequestExecutor.on('request', (request: any) => {
    logger.trace(
      {
        url: request.url,
      },
      'Okta client initiated request',
    );
  });

  defaultRequestExecutor.on('response', (response: any) => {
    logger.trace('Okta client received response');
  });

  return new okta.Client({
    orgUrl: config.oktaOrgUrl,
    token: config.oktaApiKey,
    requestExecutor: defaultRequestExecutor,
  }) as OktaClient;
}
