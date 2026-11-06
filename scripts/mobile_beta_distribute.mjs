#!/usr/bin/env node
// Reconcile finished EAS internal builds with the existing external beta tracks.
// No build/upload, credential files, tester identities, or persistent local state.
import { execFileSync } from 'node:child_process';
import { sign } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'mobile/beta-distribution.json')));
const eas = JSON.parse(readFileSync(resolve(root, 'mobile/eas.json')));
const notes = Object.entries(config.notes).map(([language, path]) => ({
  language, text: readFileSync(resolve(root, 'mobile', path), 'utf8').trim(),
}));
const args = process.argv.slice(2);
const platform = args[0];
const dryRun = args.includes('--dry-run');
if (!['ios', 'android'].includes(platform) || args.slice(1).some(arg => arg !== '--dry-run')) {
  throw new Error('Usage: node scripts/mobile_beta_distribute.mjs ios|android [--dry-run]');
}
for (const note of notes) {
  // Play's 500-character limit is stricter than TestFlight's 4,000.
  if (!note.text || [...note.text].length > 500) throw new Error(`Invalid beta notes: ${note.language}`);
}

function report(message) {
  console.log(`${platform}: ${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${platform}: ${message}\n`);
  }
}

class ApiError extends Error {
  constructor(service, status, codes) {
    // Do not print provider messages or response bodies: they may contain PII.
    super(`${service}: HTTP ${status} (${codes.join(', ') || 'no error code'})`);
    this.status = status;
    this.codes = codes;
  }
}

async function request(service, url, { method = 'GET', token, body, form } = {}) {
  const response = await fetch(url, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new ApiError(service, response.status, ['INVALID_JSON']); }
  if (!response.ok) {
    const codes = service === 'Apple'
      ? (data.errors ?? []).map(error => error.code)
      : [data.error?.status, ...(data.error?.details ?? []).map(detail => detail.reason)].filter(Boolean);
    const parameters = (data.errors ?? []).map(error => error.source?.parameter).filter(Boolean);
    const error = new ApiError(service, response.status, codes);
    error.message += ` at ${method} ${new URL(url).pathname}${parameters.length ? `; parameters: ${parameters.join(', ')}` : ''}`;
    throw error;
  }
  return data;
}

function credential(name) {
  if (!process.env[name]) throw new Error(`Missing GitHub secret / environment variable: ${name}`);
  return JSON.parse(process.env[name]);
}

function jwt(header, payload, key, algorithm) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode(header)}.${encode(payload)}`;
  const signature = sign(algorithm, Buffer.from(input), {
    key, ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' } : {}),
  });
  return `${input}.${signature.toString('base64url')}`;
}

function candidate() {
  const builds = JSON.parse(execFileSync('eas', [
    'build:list', '--platform', platform, '--buildProfile', config.buildProfile,
    '--status', 'finished', '--limit', '1', '--json', '--non-interactive',
  ], { cwd: resolve(root, 'mobile'), encoding: 'utf8', timeout: 120_000 }));
  const build = builds[0];
  if (!build) { report('No finished internal build.'); return null; }
  if (!/^\d+$/.test(build.appBuildVersion) || !build.appVersion) {
    throw new Error('EAS build has no valid store version / build number.');
  }
  report(`EAS candidate ${build.appVersion} (${build.appBuildVersion})${dryRun ? ' — dry run' : ''}.`);
  return build;
}

async function ios(build) {
  const key = credential('BETA_ASC_API_KEY_JSON');
  const now = Math.floor(Date.now() / 1000);
  const token = jwt({ alg: 'ES256', kid: key.keyId, typ: 'JWT' }, {
    iss: key.issuerId, iat: now - 30, exp: now + 900, aud: 'appstoreconnect-v1',
  }, key.privateKey, 'sha256');
  const api = (path, options) => request('Apple', `https://api.appstoreconnect.apple.com/v1/${path}`, { token, ...options });
  async function all(path) {
    const items = [];
    let url = `https://api.appstoreconnect.apple.com/v1/${path}`;
    for (let page = 0; url; page++) {
      if (page >= 20 || new URL(url).origin !== 'https://api.appstoreconnect.apple.com') {
        throw new Error('Unexpected Apple pagination.');
      }
      const result = await request('Apple', url, { token });
      items.push(...result.data);
      url = result.links?.next;
    }
    return items;
  }
  const appId = eas.submit[config.buildProfile].ios.ascAppId;
  const groupId = config.ios.externalGroupId;
  const group = (await api(`betaGroups/${groupId}`)).data;
  if (group.attributes.isInternalGroup || !group.attributes.publicLinkEnabled) {
    throw new Error('Configured TestFlight group must be external with its existing public link enabled.');
  }
  const groupApp = (await api(`betaGroups/${groupId}/app`)).data;
  if (groupApp.id !== appId) throw new Error('TestFlight group belongs to a different app.');
  const query = new URLSearchParams({
    'filter[app]': appId, 'filter[version]': build.appBuildVersion,
    include: 'preReleaseVersion', limit: '200',
  });
  const result = await api(`builds?${query}`);
  const versions = new Map((result.included ?? []).map(item => [item.id, item.attributes.version]));
  const matches = result.data.filter(item => versions.get(item.relationships.preReleaseVersion.data.id) === build.appVersion);
  if (matches.length === 0) { report('Waiting for EAS upload / Apple processing; next run will retry.'); return; }
  if (matches.length !== 1) throw new Error('Ambiguous TestFlight build.');
  const target = matches[0];
  if (target.attributes.expired) throw new Error('Candidate TestFlight build has expired.');
  if (target.attributes.processingState !== 'VALID') {
    if (target.attributes.processingState !== 'PROCESSING') throw new Error('Apple build processing failed.');
    report('Apple is still processing the build; next run will retry.'); return;
  }
  // Do not expose an older build if someone already distributed a newer one.
  const groupBuilds = await all(`betaGroups/${groupId}/builds?limit=200`);
  if (groupBuilds.some(item => !item.attributes.expired &&
    new Date(item.attributes.uploadedDate) > new Date(target.attributes.uploadedDate))) {
    report('A newer build is already assigned to the external group; skipping.'); return;
  }
  const detail = (await api(`builds/${target.id}/buildBetaDetail`)).data;
  const state = detail.attributes.externalBuildState;
  report(`TestFlight external state: ${state}.`);
  const submitted = ['WAITING_FOR_BETA_REVIEW', 'IN_BETA_REVIEW', 'BETA_APPROVED',
    'READY_FOR_BETA_TESTING', 'IN_BETA_TESTING'];
  if (!submitted.includes(state) && state !== 'READY_FOR_BETA_SUBMISSION') {
    throw new Error(`TestFlight build cannot be submitted automatically: ${state}`);
  }
  const localizations = await all(`builds/${target.id}/betaBuildLocalizations?limit=200`);
  const assigned = groupBuilds.some(item => item.id === target.id);
  if (dryRun) {
    const matchingNotes = notes.every(note => localizations.some(item =>
      item.attributes.locale === note.language && item.attributes.whatsNew === note.text));
    report(`Welcome notes match: ${matchingNotes}; external group assigned: ${assigned}; automatic notification: ${detail.attributes.autoNotifyEnabled}.`);
    report('Would ensure FR/EN notes, automatic notification, external group, and beta review.'); return;
  }
  for (const { language: locale, text: whatsNew } of notes) {
    const existing = localizations.find(item => item.attributes.locale === locale);
    if (existing?.attributes.whatsNew === whatsNew) continue;
    await api(existing ? `betaBuildLocalizations/${existing.id}` : 'betaBuildLocalizations', {
      method: existing ? 'PATCH' : 'POST',
      body: { data: {
        type: 'betaBuildLocalizations', ...(existing ? { id: existing.id } : {}),
        attributes: { whatsNew, ...(!existing ? { locale } : {}) },
        ...(!existing ? { relationships: { build: { data: { type: 'builds', id: target.id } } } } : {}),
      } },
    });
  }
  if (!detail.attributes.autoNotifyEnabled) {
    await api(`buildBetaDetails/${detail.id}`, { method: 'PATCH', body: {
      data: { type: 'buildBetaDetails', id: detail.id, attributes: { autoNotifyEnabled: true } },
    } });
  }
  if (!assigned) await api(`betaGroups/${groupId}/relationships/builds`, {
    method: 'POST', body: { data: [{ type: 'builds', id: target.id }] },
  });
  // Refresh after assigning: Apple may already have moved an approved version.
  const refreshed = (await api(`builds/${target.id}/buildBetaDetail`)).data.attributes.externalBuildState;
  if (refreshed === 'READY_FOR_BETA_SUBMISSION') {
    await api('betaAppReviewSubmissions', { method: 'POST', body: { data: {
      type: 'betaAppReviewSubmissions',
      relationships: { build: { data: { type: 'builds', id: target.id } } },
    } } });
    report('Submitted for TestFlight beta review; automatic tester notification enabled.');
  } else if (submitted.includes(refreshed)) {
    report(`Already submitted / available (${refreshed}); no duplicate review.`);
  } else throw new Error(`Unexpected TestFlight state after group assignment: ${refreshed}`);
}

async function android(build) {
  const key = credential('BETA_GOOGLE_PLAY_API_KEY_JSON');
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt({ alg: 'RS256', typ: 'JWT' }, {
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now - 30, exp: now + 900,
  }, key.private_key, 'RSA-SHA256');
  const auth = await request('Google OAuth', 'https://oauth2.googleapis.com/token', {
    method: 'POST', form: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
    }),
  });
  if (!auth.access_token) throw new Error('Google OAuth returned no access token.');
  const { packageName, sourceTrack, targetTrack } = config.android;
  if (targetTrack === 'production' || targetTrack === sourceTrack) throw new Error('Expected a separate closed beta track.');
  const api = (path, options) => request('Google Play',
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits${path}`,
    { token: auth.access_token, ...options });
  // Even inspection requires a temporary edit. A dry run always discards it.
  const edit = await api('', { method: 'POST', body: {} });
  let committed = false;
  try {
    const tracks = (await api(`/${edit.id}/tracks`)).tracks;
    const source = tracks.find(track => track.track === sourceTrack);
    const target = tracks.find(track => track.track === targetTrack);
    if (!source || !target) throw new Error('Existing internal / Alpha track not found.');
    const code = build.appBuildVersion;
    const targetCodes = (target.releases ?? []).flatMap(release => release.versionCodes ?? []);
    if (targetCodes.some(value => BigInt(value) >= BigInt(code))) {
      report(`Alpha already contains build ${code} or newer (including pending review); no resubmission.`); return;
    }
    const available = (source.releases ?? []).some(release =>
      release.status === 'completed' && release.versionCodes?.includes(code));
    if (!available) { report('Waiting for EAS submission to internal testing; next run will retry.'); return; }
    if (dryRun) { report(`Would promote build ${code} to ${targetTrack}, with FR/EN welcome notes and review.`); return; }
    await api(`/${edit.id}/tracks/${targetTrack}`, { method: 'PUT', body: {
      track: targetTrack, releases: [{
        name: `${build.appVersion} (${code})`, versionCodes: [code], status: 'completed', releaseNotes: notes,
      }],
    } });
    // Never cancel an ongoing review to replace it with the next build.
    await api(`/${edit.id}:commit?changesNotSentForReview=false&changesInReviewBehavior=ERROR_IF_IN_REVIEW`, { method: 'POST' });
    committed = true;
    report(`Build ${code} submitted to Alpha for review; full rollout after approval (managed publishing must stay off).`);
  } catch (error) {
    if (error instanceof ApiError && error.codes.includes('CHANGES_ALREADY_IN_REVIEW')) {
      report('Google already has changes in review; keeping that review and retrying next run.');
    } else throw error;
  } finally {
    if (!committed) {
      try { await api(`/${edit.id}`, { method: 'DELETE' }); }
      catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
    }
  }
}

try {
  const build = candidate();
  if (build) await ({ ios, android })[platform](build);
} catch (error) {
  // Do not serialize nested fetch / process errors (headers and env are private).
  const message = error instanceof ApiError ? error.message
    : error.status !== undefined ? `EAS command failed (exit ${error.status}).`
    : error.constructor === Error ? error.message : `Operation failed (${error.name}).`;
  report(`ERROR: ${message}`);
  process.exitCode = 1;
}
