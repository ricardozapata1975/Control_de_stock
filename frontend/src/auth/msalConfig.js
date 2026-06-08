import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common';
const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin;
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'Files.ReadWrite', 'openid', 'profile'],
};

export const msalInstance = demoMode || !clientId ? null : new PublicClientApplication(msalConfig);

export const isDemoMode = demoMode || !clientId;
