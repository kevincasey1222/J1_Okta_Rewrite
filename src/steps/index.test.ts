import { createMockStepExecutionContext } from '@jupiterone/integration-sdk-testing';

import { IntegrationConfig } from '../config';
import { fetchGroups, fetchUsers } from './access';
import { fetchAccountDetails } from './account';

const DEFAULT_ORG_URL = 'https://yoursubdomainhere.okta.com';
const DEFAULT_API_KEY = 'dummy-okta-api-key';

const integrationConfig: IntegrationConfig = {
  oktaOrgUrl: process.env.OKTA_ORG_URL || DEFAULT_ORG_URL,
  oktaApiKey: process.env.OKTA_API_KEY || DEFAULT_API_KEY,
};

test('should collect data', async () => {
  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  // Simulates dependency graph execution.
  // See https://github.com/JupiterOne/sdk/issues/262.
  await fetchAccountDetails(context);
  await fetchUsers(context);
  await fetchGroups(context);

  // Review snapshot, failure is a regression
  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot();

  const accounts = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('Account'),
  );
  expect(accounts.length).toBeGreaterThan(0);
  expect(accounts).toMatchGraphObjectSchema({
    _class: ['Account'],
    schema: {
      properties: {
        _type: { const: 'okta_account' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: [],
    },
  });

  const users = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('User'),
  );
  expect(users.length).toBeGreaterThan(0);
  expect(users).toMatchGraphObjectSchema({
    _class: ['User'],
    schema: {
      additionalProperties: false,
      properties: {
        _type: { const: 'acme_user' },
        firstName: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['firstName'],
    },
  });

  const userGroups = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('UserGroup'),
  );
  expect(userGroups.length).toBeGreaterThan(0);
  expect(userGroups).toMatchGraphObjectSchema({
    _class: ['UserGroup'],
    schema: {
      additionalProperties: false,
      properties: {
        _type: { const: 'acme_group' },
        logoLink: {
          type: 'string',
          // Validate that the `logoLink` property has a URL format
          format: 'url',
        },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['logoLink'],
    },
  });
});
