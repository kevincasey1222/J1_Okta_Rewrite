import {
  createDirectRelationship,
  createIntegrationEntity,
  Entity,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';
import * as url from 'url';
import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { DATA_ACCOUNT_ENTITY } from './account';
import { USER_GROUP_ENTITY_TYPE } from './access';

import buildAppShortName from '../util/buildAppShortName';
import getOktaAccountInfo from '../util/getOktaAccountInfo';
import getOktaAccountAdminUrl from '../util/getOktaAccountAdminUrl';
import {
  getAccountName,
  getVendorName,
  isMultiInstanceApp,
} from '../util/knownVendors';

import { OktaIntegrationConfig } from '../types';

export const APPLICATION_ENTITY_TYPE = 'okta_application';

export async function fetchApplications({
  instance,
  jobState,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const apiClient = createAPIClient(instance.config, logger);

  const accountEntity = (await jobState.getData(DATA_ACCOUNT_ENTITY)) as Entity;

  await apiClient.iterateApplications(async (app) => {
    const webLink = url.resolve(
      getOktaAccountAdminUrl(instance.config as OktaIntegrationConfig),
      `/admin/app/${app.name}/instance/${app.id}`,
    );

    let imageUrl;
    let loginUrl;

    if (app._links?.logo) {
      //the original said:
      //  imageUrl = [app._links.logo].flat()[0].href;
      // but TypeScript is complaining that flat() dne
      //TODO : are there really nested arrays in some cases?
      // And if so, how best to flatten them in this case?
      imageUrl = app._links?.logo[0].href;
    }

    if (app._links?.appLinks) {
      //const links = [app._links.appLinks].flat();
      //const link = links.find((l) => l.name === 'login') || links[0];
      // loginUrl = link && link.href;
      //same typescript error as in .logo
      const link = app._links?.appLinks[0];
      loginUrl = link && link.href;
    }

    const oktaAccountInfo = getOktaAccountInfo(instance);
    const appShortName = buildAppShortName(oktaAccountInfo, app.name);

    const assignData = {
      _key: app.id,
      _type: APPLICATION_ENTITY_TYPE,
      _class: 'Application',
      id: app.id,
      displayName: app.label || app.name || app.id,
      name: app.name || app.label,
      shortName: appShortName,
      label: app.label,
      status: app.status,
      active: app.status === 'ACTIVE',
      lastUpdated: app.lastUpdated,
      created: app.created,
      features: app.features,
      signOnMode: app.signOnMode,
      appVendorName: getVendorName(appShortName),
      appAccountType: getAccountName(appShortName),
      isMultiInstanceApp: isMultiInstanceApp(appShortName),
      isSAMLApp: !!app.signOnMode && app.signOnMode.startsWith('SAML'),
      webLink,
      imageUrl,
      loginUrl,
    };

    const appSettings = app.settings && app.settings.app;
    if (appSettings) {
      if (appSettings.awsEnvironmentType === 'aws.amazon') {
        if (appSettings.identityProviderArn) {
          const awsAccountIdMatch = /^arn:aws:iam::([0-9]+):/.exec(
            appSettings.identityProviderArn,
          );
          if (awsAccountIdMatch) {
            assignData['awsAccountId'] = awsAccountIdMatch[1];
            assignData['appAccountId'] = awsAccountIdMatch[1];
          }
        }

        assignData['awsIdentityProviderArn'] = appSettings.identityProviderArn;
        assignData['awsEnvironmentType'] = appSettings.awsEnvironmentType;
        assignData['awsGroupFilter'] = appSettings.groupFilter;
        assignData['awsRoleValuePattern'] = appSettings.roleValuePattern;
        assignData['awsJoinAllRoles'] = appSettings.joinAllRoles;
        assignData['awsSessionDuration'] = appSettings.sessionDuration;
      } else if (appSettings.githubOrg) {
        assignData['githubOrg'] = appSettings.githubOrg;
        assignData['appAccountId'] = appSettings.githubOrg;
      } else if (appSettings.domain) {
        // Google Cloud Platform and G Suite apps use `domain` as the account identifier
        assignData['appDomain'] = appSettings.domain;
        assignData['appAccountId'] = appSettings.domain;
      }
    }

    const appEntity = await jobState.addEntity(
      createIntegrationEntity({
        entityData: {
          source: app,
          assign: { ...assignData },
        },
      }),
    );

    //TODO: change the below to be right
    await jobState.addRelationship(
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        from: accountEntity,
        to: appEntity,
      }),
    );

    //assign the groups that use this app
    const groupIds = await apiClient.getGroupsForApp(app.id);
    for (const groupId of groupIds || []) {
      const groupEntity = await jobState.findEntity(groupId);

      if (!groupEntity) {
        throw new IntegrationMissingKeyError(
          `Expected group with key to exist (key=${groupId})`,
        );
      }

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.ASSIGNED,
          from: groupEntity,
          to: appEntity,
        }),
      );
    }
  });
}
export const applicationSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-applications',
    name: 'Fetch Applications',
    entities: [
      {
        resourceName: 'Okta Application',
        _type: APPLICATION_ENTITY_TYPE,
        _class: 'Application',
      },
    ],
    relationships: [
      {
        _type: 'okta_account_has_application',
        _class: RelationshipClass.HAS,
        sourceType: 'okta_account',
        targetType: APPLICATION_ENTITY_TYPE,
      },
      {
        _type: 'okta_user_group_assigned_application',
        _class: RelationshipClass.ASSIGNED,
        sourceType: USER_GROUP_ENTITY_TYPE,
        targetType: APPLICATION_ENTITY_TYPE,
      },
    ],
    dependsOn: ['fetch-users'],
    executionHandler: fetchApplications,
  },
];
