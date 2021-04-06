import {
  createIntegrationEntity,
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../config';
import getOktaAccountInfo from '../util/getOktaAccountInfo';

export const DATA_ACCOUNT_ENTITY = 'DATA_ACCOUNT_ENTITY';

export async function fetchAccountDetails({
  jobState,
  instance,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const oktaAccountInfo = getOktaAccountInfo({
    name: instance.name,
    config: instance.config,
  });
  let displayName = oktaAccountInfo.name;
  if (oktaAccountInfo.preview) {
    displayName += ' (preview)';
  }
  const accountId = instance.config.oktaOrgUrl.replace(/^https?:\/\//, '');
  const accountEntity = await jobState.addEntity(
    createIntegrationEntity({
      entityData: {
        source: {
          id: `okta-account:${instance.name}`,
          name: 'Okta Account',
        },
        assign: {
          _key: `okta_account_${accountId}`,
          _type: 'okta_account',
          _class: 'Account',
          name: oktaAccountInfo.name,
          displayName: displayName,
          webLink: instance.config.oktaOrgUrl,
          accountId,
        },
      },
    }),
  );

  await jobState.setData(DATA_ACCOUNT_ENTITY, accountEntity);
}

export const accountSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-account',
    name: 'Fetch Account Details',
    entities: [
      {
        resourceName: 'Okta Account',
        _type: 'okta_account',
        _class: 'Account',
      },
    ],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchAccountDetails,
  },
];
