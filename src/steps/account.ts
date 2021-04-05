import {
  createIntegrationEntity,
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';

export const DATA_ACCOUNT_ENTITY = 'DATA_ACCOUNT_ENTITY';
export const ACCOUNT_ENTITY_KEY = 'okta:account';

export async function fetchAccountDetails({
  jobState,
  instance,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const accountEntity = await jobState.addEntity(
    createIntegrationEntity({
      entityData: {
        source: {
          id: `okta-account:${instance.name}`,
          name: 'Okta Account',
        },
        assign: {
          _key: `okta-account:${instance.id}`,
          _type: 'okta_account',
          _class: 'Account',
          name: `Okta - ${instance.name}`,
          displayName: `Okta - ${instance.name}`,
          webLink: instance.config.oktaOrgUrl,
        },
      },
    }),
  );

  await jobState.setData(ACCOUNT_ENTITY_KEY, accountEntity);
}

export const accountSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-account',
    name: 'Fetch Account Details',
    entities: [
      {
        resourceName: 'Account',
        _type: 'okta_account',
        _class: 'Account',
      },
    ],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchAccountDetails,
  },
];
