/**
 * Clerk authentication and Supabase cloud persistence.
 * Clerk owns identity; Supabase stores user-owned resume and profile data.
 */

let clerk = null;
let supabaseClient = null;
let initializationPromise = null;
let previousAuthUserId = null;

const currentConfig = {
  clerkPublishableKey: '',
  supabaseUrl: '',
  supabasePublishableKey: ''
};

const cloudState = {
  userId: null,
  activeResumeId: null,
  activeResumeVersion: null,
  profileVersion: null,
  profileLoaded: false
};

export async function initSupabase() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = initializeServices().catch((error) => {
    console.error('Could not initialize Clerk and cloud sync:', error);
    return false;
  });

  return initializationPromise;
}

async function initializeServices() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Could not load the public application configuration.');
  }

  const config = await response.json();
  currentConfig.clerkPublishableKey = config.clerkPublishableKey || '';
  currentConfig.supabaseUrl = config.supabaseUrl || '';
  currentConfig.supabasePublishableKey = config.supabasePublishableKey || config.supabaseAnonKey || '';

  if (currentConfig.clerkPublishableKey) {
    await initializeClerk(currentConfig.clerkPublishableKey);
  }

  if (currentConfig.supabaseUrl && currentConfig.supabasePublishableKey && window.supabase) {
    supabaseClient = window.supabase.createClient(
      currentConfig.supabaseUrl,
      currentConfig.supabasePublishableKey,
      {
        async accessToken() {
          return clerk?.session?.getToken() ?? null;
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
  }

  previousAuthUserId = getCurrentUserSync()?.id || null;
  return isAuthConfigured();
}

async function initializeClerk(publishableKey) {
  if (window.Clerk?.loaded) {
    clerk = window.Clerk;
    return;
  }

  const clerkDomain = getClerkDomain(publishableKey);
  await loadScript(
    'jobease-clerk-ui',
    `https://${clerkDomain}/npm/@clerk/ui@1.42.4/dist/ui.browser.js`
  );
  await loadScript(
    'jobease-clerk-js',
    `https://${clerkDomain}/npm/@clerk/clerk-js@6.42.3/dist/clerk.browser.js`,
    { 'data-clerk-publishable-key': publishableKey }
  );

  if (!window.Clerk) {
    throw new Error('ClerkJS did not load. Check the Clerk publishable key and allowed origins.');
  }

  await window.Clerk.load({
    ui: { ClerkUI: window.__internal_ClerkUICtor }
  });
  clerk = window.Clerk;
}

function getClerkDomain(publishableKey) {
  const encoded = publishableKey.replace(/^pk_(test|live)_/, '');
  if (!encoded || encoded === publishableKey) {
    throw new Error('The Clerk publishable key has an invalid format.');
  }

  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const domain = atob(padded).replace(/\$$/, '');
    if (!/^[a-z0-9.-]+$/i.test(domain) || domain.includes('..')) {
      throw new Error('Invalid Clerk domain');
    }
    return domain;
  } catch {
    throw new Error('The Clerk publishable key could not be decoded.');
  }
}

function loadScript(id, src, attributes = {}) {
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export function isAuthConfigured() {
  return !!(clerk && currentConfig.clerkPublishableKey);
}

export function isConfigured() {
  return !!(
    isAuthConfigured() &&
    supabaseClient &&
    currentConfig.supabaseUrl &&
    currentConfig.supabasePublishableKey
  );
}

export function getConfigurationStatus() {
  return {
    authReady: isAuthConfigured(),
    cloudReady: isConfigured(),
    hasClerkKey: !!currentConfig.clerkPublishableKey,
    hasSupabaseConfig: !!(currentConfig.supabaseUrl && currentConfig.supabasePublishableKey)
  };
}

export async function openSignIn() {
  if (!isAuthConfigured()) {
    throw new Error('Clerk is not configured. Add CLERK_PUBLISHABLE_KEY to .env and restart the server.');
  }

  await clerk.openSignIn({
    appearance: {
      variables: {
        colorPrimary: '#6366f1',
        borderRadius: '0.75rem'
      }
    }
  });
}

export async function openUserProfile() {
  if (!isAuthConfigured() || !getCurrentUserSync()) return;
  await clerk.openUserProfile();
}

export async function signOut() {
  if (!isAuthConfigured()) return;
  await clerk.signOut();
}

export async function getCurrentUser() {
  return getCurrentUserSync();
}

function getCurrentUserSync(rawUser = clerk?.user) {
  if (!rawUser) return null;

  const email = rawUser.primaryEmailAddress?.emailAddress || rawUser.emailAddresses?.[0]?.emailAddress || '';
  const displayName = rawUser.fullName || [rawUser.firstName, rawUser.lastName].filter(Boolean).join(' ') || email.split('@')[0] || 'Account';

  return {
    id: rawUser.id,
    email,
    displayName,
    imageUrl: rawUser.imageUrl || ''
  };
}

export function onAuthStateChange(callback) {
  if (!isAuthConfigured()) return () => {};

  return clerk.addListener(({ user }) => {
    if (user === undefined) return;

    const normalizedUser = getCurrentUserSync(user);
    const nextUserId = normalizedUser?.id || null;
    let event = 'SESSION_UPDATED';

    if (nextUserId && nextUserId !== previousAuthUserId) event = 'SIGNED_IN';
    if (!nextUserId && previousAuthUserId) event = 'SIGNED_OUT';

    previousAuthUserId = nextUserId;
    if (!nextUserId) ensureCloudStateUser(null);
    callback(event, normalizedUser);
  }, { skipInitialEmit: true });
}

function requireCloud() {
  if (!isConfigured()) {
    throw new Error('Cloud sync is not configured. Check the Clerk and Supabase environment variables.');
  }

  const user = getCurrentUserSync();
  if (!user) throw new Error('Sign in before using cloud sync.');
  ensureCloudStateUser(user.id);
  return user;
}

function ensureCloudStateUser(userId) {
  if (cloudState.userId === userId) return;
  cloudState.userId = userId || null;
  cloudState.activeResumeId = null;
  cloudState.activeResumeVersion = null;
  cloudState.profileVersion = null;
  cloudState.profileLoaded = false;
}

export function getActiveCloudResumeId() {
  const user = getCurrentUserSync();
  if (!user) return null;
  ensureCloudStateUser(user.id);
  return cloudState.activeResumeId;
}

export function setActiveCloudResumeId(id, version = null) {
  const user = getCurrentUserSync();
  if (!user) return;
  ensureCloudStateUser(user.id);
  cloudState.activeResumeId = id || null;
  cloudState.activeResumeVersion = id && Number.isInteger(Number(version)) ? Number(version) : null;
}

export function getActiveCloudResumeVersion() {
  const user = getCurrentUserSync();
  if (!user) return null;
  ensureCloudStateUser(user.id);
  return cloudState.activeResumeVersion;
}

export async function listUserResumes() {
  requireCloud();

  const { data, error } = await supabaseClient
    .from('resumes')
    .select('id, name, updated_at, created_at, is_master, version')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchResumeById(resumeId) {
  requireCloud();
  if (!resumeId) throw new Error('A resume ID is required.');

  const { data, error } = await supabaseClient
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .single();

  if (error) throw error;
  return data;
}

export async function saveResumeToCloud(resumeData, options = {}) {
  const user = requireCloud();
  const forceNew = options.forceNew === true;
  const hasExplicitResumeId = Object.prototype.hasOwnProperty.call(options, 'resumeId');
  const resumeId = forceNew ? null : (hasExplicitResumeId ? options.resumeId : null);
  const candidateName = (resumeData?.personalInfo?.name || '').trim();
  const name = (options.name || '').trim() || (candidateName ? `${candidateName}'s Resume` : 'My Resume');

  const payload = {
    user_id: user.id,
    resume_data: resumeData,
    section_order: options.sectionOrder || resumeData?.sectionOrder || [],
    enabled_sections: options.enabledSections || resumeData?.enabledSections || [],
    section_titles: options.sectionTitles || resumeData?.sectionTitles || {},
    spacing_config: options.spacingConfig || {},
    font: options.font || 'lmodern',
    paper_size: options.paperSize || 'a4',
    is_master: !!options.isMaster,
    schema_version: 1
  };

  if (!resumeId) {
    const { data, error } = await supabaseClient
      .from('resumes')
      .insert({ ...payload, name, version: 1 })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  let expectedVersion = options.expectedVersion || (
    getActiveCloudResumeId() === resumeId ? getActiveCloudResumeVersion() : null
  );
  if (!expectedVersion) {
    const baselineError = new Error('Reload this cloud resume before updating it because its version baseline is missing.');
    baselineError.code = 'SYNC_BASELINE_REQUIRED';
    throw baselineError;
  }

  const updatePayload = { ...payload, version: expectedVersion + 1 };
  if ((options.name || '').trim()) updatePayload.name = options.name.trim();

  const { data, error } = await supabaseClient
    .from('resumes')
    .update(updatePayload)
    .eq('id', resumeId)
    .eq('version', expectedVersion)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const conflict = new Error('This resume changed on another device. Reload it before saving again.');
    conflict.code = 'SYNC_CONFLICT';
    throw conflict;
  }
  return data;
}

export async function deleteResumeFromCloud(resumeId) {
  requireCloud();

  const { error } = await supabaseClient
    .from('resumes')
    .delete()
    .eq('id', resumeId);

  if (error) throw error;
}

export async function fetchMasterProfileFromCloud() {
  const user = requireCloud();
  const { data, error } = await supabaseClient
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (getCurrentUserSync()?.id === user.id) {
    ensureCloudStateUser(user.id);
    cloudState.profileVersion = data?.version || null;
    cloudState.profileLoaded = true;
  }
  return data;
}

export async function saveMasterProfileToCloud(profile) {
  const user = requireCloud();
  if (!cloudState.profileLoaded) {
    const baselineError = new Error('Load the cloud Master Profile before updating it.');
    baselineError.code = 'SYNC_BASELINE_REQUIRED';
    throw baselineError;
  }
  let expectedVersion = cloudState.userId === user.id ? Number(cloudState.profileVersion) : null;
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) expectedVersion = null;

  if (!expectedVersion) {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .insert({
        user_id: user.id,
        master_profile: profile,
        schema_version: 1,
        version: 1
      })
      .select()
      .single();

    if (error?.code === '23505') {
      const conflict = new Error('A Master Profile was created on another device. Reload it before saving.');
      conflict.code = 'PROFILE_SYNC_CONFLICT';
      throw conflict;
    }
    if (error) throw error;
    if (getCurrentUserSync()?.id === user.id) {
      ensureCloudStateUser(user.id);
      cloudState.profileVersion = data.version || 1;
    }
    return data;
  }

  const { data, error } = await supabaseClient
    .from('user_profiles')
    .update({
      master_profile: profile,
      schema_version: 1,
      version: expectedVersion + 1
    })
    .eq('user_id', user.id)
    .eq('version', expectedVersion)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const conflict = new Error('Your Master Profile changed on another device. Reload before saving again.');
    conflict.code = 'PROFILE_SYNC_CONFLICT';
    throw conflict;
  }
  if (getCurrentUserSync()?.id === user.id) {
    ensureCloudStateUser(user.id);
    cloudState.profileVersion = data.version;
  }
  return data;
}
