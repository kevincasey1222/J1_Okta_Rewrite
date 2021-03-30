import { IntegrationStepIterationState } from '@jupiterone/jupiter-managed-integration-sdk';

export * from './entities';
export * from './relationships';

export interface OktaIntegrationConfig {
  oktaApiKey: string;
  oktaOrgUrl: string;
}

export interface OktaIntegrationStepIterationState
  extends IntegrationStepIterationState {
  state: {
    after?: string;
    seen?: number;
    limit?: number;
    pages?: number;
    applicationIndex?: number;
  };
}
