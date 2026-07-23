import { describe, expect, it } from "vitest";
import { classifyOAuthRefreshFailure } from "../lib/oauth-refresh-error";

describe("classifyOAuthRefreshFailure", () => {
  it("marks an expired Microsoft refresh token for reauthentication", () => {
    const result = classifyOAuthRefreshFailure(
      "microsoft",
      JSON.stringify({
        error: "invalid_grant",
        error_description: "AADSTS700082: The refresh token has expired due to inactivity."
      })
    );

    expect(result).toEqual({
      error: "ms_refresh_failed:AADSTS700082",
      reauthRequired: true
    });
  });

  it("does not revoke a connection for an application credential failure", () => {
    const result = classifyOAuthRefreshFailure(
      "microsoft",
      JSON.stringify({
        error: "invalid_client",
        error_description: "The client secret is invalid."
      })
    );

    expect(result).toEqual({
      error: "ms_refresh_failed:invalid_client",
      reauthRequired: false
    });
  });

  it("marks a Google invalid_grant response for reauthentication", () => {
    const result = classifyOAuthRefreshFailure(
      "google",
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Token has been expired or revoked."
      })
    );

    expect(result).toEqual({
      error: "google_refresh_failed:invalid_grant",
      reauthRequired: true
    });
  });

  it("does not expose an unstructured provider response", () => {
    const result = classifyOAuthRefreshFailure("microsoft", "<html>upstream error</html>");

    expect(result).toEqual({
      error: "ms_refresh_failed:unknown",
      reauthRequired: false
    });
  });
});
