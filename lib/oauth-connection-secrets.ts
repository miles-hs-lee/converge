import { createAdminClient } from "@/lib/supabase/admin";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

export type OAuthConnectionSecretRow = {
  connection_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
};

const TOKEN_ENC_PREFIX = "enc:v1";
const TOKEN_ENC_SEPARATOR = ".";

let cachedEncryptionKey: Buffer | null = null;

function resolveEncryptionKeyMaterial(): string {
  const explicitKey = serverEnv.oauthSecretsEncryptionKey?.trim();
  if (explicitKey) {
    return explicitKey;
  }
  const fallback = serverEnv.supabaseServiceRoleKey?.trim();
  if (fallback) {
    return fallback;
  }
  throw new Error("oauth_secret_encryption_key_missing");
}

function getEncryptionKey(): Buffer {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }
  cachedEncryptionKey = createHash("sha256").update(resolveEncryptionKeyMaterial()).digest();
  return cachedEncryptionKey;
}

function encryptToken(plainText: string): string {
  if (!plainText) {
    return plainText;
  }
  if (plainText.startsWith(`${TOKEN_ENC_PREFIX}${TOKEN_ENC_SEPARATOR}`)) {
    return plainText;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${TOKEN_ENC_PREFIX}${TOKEN_ENC_SEPARATOR}${iv.toString("base64url")}${TOKEN_ENC_SEPARATOR}${authTag.toString("base64url")}${TOKEN_ENC_SEPARATOR}${encrypted.toString("base64url")}`;
}

export function isSecretEncrypted(storedValue: string): boolean {
  return storedValue.startsWith(`${TOKEN_ENC_PREFIX}${TOKEN_ENC_SEPARATOR}`);
}

function decryptToken(storedValue: string): string {
  if (!storedValue) {
    return storedValue;
  }
  if (!storedValue.startsWith(`${TOKEN_ENC_PREFIX}${TOKEN_ENC_SEPARATOR}`)) {
    return storedValue;
  }

  const [, ivPart, authTagPart, encryptedPart] = storedValue.split(TOKEN_ENC_SEPARATOR);
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("oauth_secret_payload_invalid");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}

function decodeSecretRow(row: OAuthConnectionSecretRow): OAuthConnectionSecretRow {
  return {
    connection_id: row.connection_id,
    access_token_enc: decryptToken(row.access_token_enc),
    refresh_token_enc: decryptToken(row.refresh_token_enc)
  };
}

export async function getOAuthConnectionSecret(connectionId: string): Promise<OAuthConnectionSecretRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_connection_secrets")
    .select("connection_id,access_token_enc,refresh_token_enc")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`oauth_connection_secret_read_failed:${error.message}`);
  }
  if (!data) {
    return null;
  }
  const decoded = decodeSecretRow(data);

  if (!isSecretEncrypted(data.access_token_enc) || !isSecretEncrypted(data.refresh_token_enc)) {
    void upsertOAuthConnectionSecret({
      connectionId: decoded.connection_id,
      accessToken: decoded.access_token_enc,
      refreshToken: decoded.refresh_token_enc,
      adminClient: admin
    });
  }

  return decoded;
}

export async function getOAuthConnectionSecrets(connectionIds: string[]): Promise<Map<string, OAuthConnectionSecretRow>> {
  const map = new Map<string, OAuthConnectionSecretRow>();
  if (connectionIds.length === 0) {
    return map;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_connection_secrets")
    .select("connection_id,access_token_enc,refresh_token_enc")
    .in("connection_id", connectionIds);

  if (error) {
    throw new Error(`oauth_connection_secrets_read_failed:${error.message}`);
  }
  if (!data) {
    return map;
  }

  data.forEach((row) => {
    try {
      map.set(row.connection_id, decodeSecretRow(row));
    } catch {
      // Treat unreadable secrets as missing to trigger reauth for that connection only.
    }
  });
  return map;
}

export async function upsertOAuthConnectionSecret(params: {
  connectionId: string;
  accessToken: string;
  refreshToken: string;
  adminClient?: ReturnType<typeof createAdminClient>;
}): Promise<boolean> {
  const admin = params.adminClient ?? createAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("oauth_connection_secrets").upsert(
    {
      connection_id: params.connectionId,
      access_token_enc: encryptToken(params.accessToken),
      refresh_token_enc: encryptToken(params.refreshToken),
      updated_at: nowIso
    },
    { onConflict: "connection_id" }
  );

  return !error;
}
