/** Barmoq izi / Face ID (WebAuthn platform authenticator) — brauzer tomoni */

const toB64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof window !== 'undefined' && 'PublicKeyCredential' in window && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export interface ChallengeResp {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  displayName: string;
  credentialId: string | null;
  timeout: number;
}

/** Yangi barmoq izi kalitini yaratish (qurilmada saqlanadi, serverga faqat ochiq kalit ketadi) */
export async function createCredential(c: ChallengeResp) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: fromB64u(c.challenge),
      rp: { id: c.rpId, name: c.rpName },
      user: { id: fromB64u(c.userId), name: c.userName, displayName: c.displayName },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: c.timeout,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('cancelled');
  const res = cred.response as AuthenticatorAttestationResponse;
  const pk = res.getPublicKey?.();
  if (!pk) throw new Error('unsupported');
  return { credentialId: toB64u(cred.rawId), publicKey: toB64u(pk), alg: res.getPublicKeyAlgorithm(), clientDataJSON: toB64u(res.clientDataJSON) };
}

/** Barmoq izi bilan tasdiqlash */
export async function getAssertion(c: ChallengeResp) {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: fromB64u(c.challenge),
      rpId: c.rpId,
      allowCredentials: c.credentialId ? [{ type: 'public-key', id: fromB64u(c.credentialId), transports: ['internal'] }] : [],
      userVerification: 'required',
      timeout: c.timeout,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('cancelled');
  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: toB64u(cred.rawId),
    clientDataJSON: toB64u(res.clientDataJSON),
    authenticatorData: toB64u(res.authenticatorData),
    signature: toB64u(res.signature),
  };
}
