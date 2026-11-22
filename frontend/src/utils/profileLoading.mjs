export async function loadAccountProfile(getToken, getMe, { signal, attempts = 3, delay = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const token = await getToken({ skipCache: attempt > 0 });
      if (!token) throw Object.assign(new Error('Your session needs to be refreshed. Please sign in again.'), { status: 401 });
      const data = await getMe(token, { signal });
      if (!data?.user?.username) throw new Error('Your profile could not be loaded. Please retry.');
      return { profile: data.user, needsSetup: false };
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      if (error.status === 404 && error.code === 'PROFILE_NOT_FOUND') return { profile: null, needsSetup: true };
      if (attempt === attempts - 1 || (error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429)) throw error;
      await delay(1000 * (attempt + 1));
    }
  }
}
