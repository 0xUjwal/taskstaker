async function withinTimeout(work, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Account loading timed out. Please retry.'), { status: 408 })), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function loadAccountProfile(getToken, getMe, { signal, attempts = 3, timeoutMs = 20000, delay = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const data = await withinTimeout(async () => {
        const token = await getToken({ skipCache: attempt > 0 });
        if (!token) throw Object.assign(new Error('Your session needs to be refreshed. Please sign in again.'), { status: 401 });
        return getMe(token, { signal });
      }, timeoutMs);
      if (!data?.user?.username) throw new Error('Your profile could not be loaded. Please retry.');
      return { profile: data.user, needsSetup: false };
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      if (error.status === 404 && error.code === 'PROFILE_NOT_FOUND') return { profile: null, needsSetup: true };
      if (attempt === attempts - 1 || (error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status))) throw error;
      await delay(1000 * (attempt + 1));
    }
  }
}
