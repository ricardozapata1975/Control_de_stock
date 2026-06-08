import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import { config } from '../config.js';

export function createGraphClient(accessToken) {
  if (!accessToken) {
    throw new Error('Token de acceso requerido');
  }
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export function workbookBasePath() {
  const { siteId, driveId, excelItemId } = config.sharepoint;
  return `/sites/${siteId}/drives/${driveId}/items/${excelItemId}/workbook`;
}

export async function createWorkbookSession(client) {
  const path = `${workbookBasePath()}/createSession`;
  const session = await client.api(path).post({
    persistChanges: true,
  });
  return session.id;
}

export async function closeWorkbookSession(client, sessionId) {
  const path = `${workbookBasePath()}/closeSession`;
  await client.api(path).header('workbook-session-id', sessionId).post({});
}
