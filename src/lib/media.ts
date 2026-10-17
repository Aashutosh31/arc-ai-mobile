/** Shared media validation helpers. */

/** True for plausible YouTube video ids (11-char base64url). */
export const isValidYouTubeId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v);

export default isValidYouTubeId;
