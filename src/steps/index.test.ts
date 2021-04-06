import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { setupOktaRecording } from '../../test/setup/recording';
import { IntegrationConfig } from '../config';
import { fetchGroups, fetchUsers } from './access';
import { fetchAccountDetails } from './account';

const DEFAULT_ORG_URL = 'https://dev-857255.okta.com/';
const DEFAULT_API_KEY = 'dummy-api-key';

const integrationConfig: IntegrationConfig = {
  oktaOrgUrl: process.env.OKTA_ORG_URL || DEFAULT_ORG_URL,
  oktaApiKey: process.env.OKTA_API_KEY || DEFAULT_API_KEY,
};

jest.setTimeout(1000 * 60 * 1);
let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('should collect data', async () => {
  recording = setupOktaRecording({
    directory: __dirname,
    name: 'steps',
    redactedRequestHeaders: ['Authorization'],
    redactedResponseHeaders: ['set-cookie', 'public-key-pins-report-only'],
  });

  const context = createMockStepExecutionContext<IntegrationConfig>({
    instanceConfig: integrationConfig,
  });

  // Simulates dependency graph execution.
  // See https://github.com/JupiterOne/sdk/issues/262.
  await fetchAccountDetails(context);
  await fetchGroups(context); //groups come first here
  await fetchUsers(context);

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
      properties: {
        _type: { const: 'okta_user' },
        name: { type: 'string' },
        webLink: {
          type: 'string',
          format: 'url',
        },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink'],
    },
  });

  const userGroups = context.jobState.collectedEntities.filter((e) =>
    e._class.includes('UserGroup'),
  );
  expect(userGroups.length).toBeGreaterThan(0);
  expect(userGroups).toMatchGraphObjectSchema({
    _class: ['UserGroup'],
    schema: {
      properties: {
        _type: { const: 'okta_user_group' },
        name: { type: 'string' },
        webLink: {
          type: 'string',
          format: 'url',
        },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['webLink'],
    },
  });
});
