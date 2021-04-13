/* eslint-disable @typescript-eslint/no-empty-function */
import {
  IntegrationLogger,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';
import { IntegrationConfig } from './config';
export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
import createOktaClient from './okta/createOktaClient';
import {
  OktaClient,
  OktaFactor,
  OktaUser,
  OktaUserGroup,
  OktaApplication,
  OktaApplicationGroup,
  OktaApplicationUser,
} from './okta/types';

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
    await this.oktaClient.listUsers().each(async (user) => {
      await iteratee(user);
    });
    await this.oktaClient
      .listUsers({
        filter: 'status eq "DEPROVISIONED"',
      })
      .each(async (user) => {
        await iteratee(user);
      });
  }

  /**
   * Iterates each group resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateGroups(
    iteratee: ResourceIteratee<OktaUserGroup>,
  ): Promise<void> {
    await this.oktaClient.listGroups().each(async (group) => {
      await iteratee(group);
    });
  }

  /**
   * Iterates each application resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateApplications(
    iteratee: ResourceIteratee<OktaApplication>,
  ): Promise<void> {
    await this.oktaClient.listApplications().each(async (app) => {
      await iteratee(app);
    });
  }

  //retrieves the group ids that a user belongs to
  public async getGroupsForUser(userId) {
    const groups: OktaUserGroup[] = [];
    await this.oktaClient.listUserGroups(userId).each((e) => {
      groups.push(e);
    });
    return groups;
  }

  //retrieves any MFA (multi-factor authentication) devices assigned to user
  public async getDevicesForUser(userId) {
    const devices: OktaFactor[] = [];
    await this.oktaClient.listFactors(userId).each((e) => {
      devices.push(e);
    });
    return devices;
  }

  //retrieves any user groups assigned to this application
  public async getGroupsForApp(appId) {
    const groups: OktaApplicationGroup[] = [];
    await this.oktaClient.listApplicationGroupAssignments(appId).each((e) => {
      groups.push(e);
    });
    return groups;
  }

  //retrieves any individual user ids assigned to this application
  public async getUsersForApp(appId) {
    const users: OktaApplicationUser[] = [];
    await this.oktaClient.listApplicationUsers(appId).each((e) => {
      users.push(e);
    });
    return users;
  }
}

export function createAPIClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  return new APIClient(config, logger);
}
