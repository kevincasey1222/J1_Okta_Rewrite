/* eslint-disable @typescript-eslint/no-empty-function */
import {
  IntegrationLogger,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from './config';
export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
import createOktaClient from './okta/createOktaClient';
import { OktaClient, OktaFactor, OktaUser, OktaUserGroup } from './okta/types';

/**
 * An APIClient maintains authentication state and provides an interface to
 * third party data APIs.
 *
 * It is recommended that integrations wrap provider data APIs to provide a
 * place to handle error responses and implement common patterns for iterating
 * resources.
 */
export class APIClient {
  oktaClient: OktaClient;
  usersList: OktaUser[];
  constructor(readonly config: IntegrationConfig, logger: IntegrationLogger) {
    this.oktaClient = createOktaClient(logger, config);
  }

  public async verifyAuthentication(): Promise<void> {
    // the most light-weight request possible to validate credentials
    try {
      //there is always at least the Everyone group
      //note that if you don't hit the .each, it doesn't actually attempt it
      await this.oktaClient.listGroups().each((e) => {});
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: this.config.oktaOrgUrl + 'api/v1/groups',
        status: err.status,
        statusText: err.statusText,
      });
    }
  }

  /**
   * Iterates each user resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateUsers(
    iteratee: ResourceIteratee<OktaUser>,
  ): Promise<void> {
    const users: OktaUser[] = [];
    await this.oktaClient.listUsers().each((e) => {
      users.push(e);
    });

    this.usersList = users; //for use later in groups

    for (const user of users) {
      await iteratee(user);
    }
  }

  /**
   * Iterates each group resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateGroups(
    iteratee: ResourceIteratee<OktaUserGroup>,
  ): Promise<void> {
    const groups: OktaUserGroup[] = [];
    await this.oktaClient.listGroups().each((e) => {
      groups.push(e);
    });

    for (const group of groups) {
      await iteratee(group);
    }
  }

  public async getGroupsForUser(id) {
    const groupIds: string[] = [];
    await this.oktaClient.listUserGroups(id).each((e) => {
      groupIds.push(e.id);
    });
    return groupIds;
  }

  //retrieves any MFA (multi-factor authentication) devices assigned to user
  public async getDevicesForUser(id) {
    const devices: OktaFactor[] = [];
    await this.oktaClient.listFactors(id).each((e) => {
      devices.push(e);
    });
    return devices;
  }
}

export function createAPIClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  return new APIClient(config, logger);
}
