/**
 * Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import axios from "axios";
import { AUTHORIZATION_CODE, OIDC_SCOPE, PKCE_CODE_VERIFIER, REQUEST_PARAMS } from "../constants";
import { getCodeChallenge, getCodeVerifier, getJWKForTheIdToken, isValidIdToken } from "./crypto";
import { getAuthorizeEndpoint, getJwksUri, getRevokeTokenEndpoint, getTokenEndpoint } from "./op-config";
import { getSessionParameter, removeSessionParameter, setSessionParameter } from "./session";

/**
 * Checks whether authorization code present in the request.
 *
 * @returns {boolean} true if authorization code is present.
 */
export const hasAuthorizationCode = () => {
    return !!new URL(window.location.href).searchParams.get(AUTHORIZATION_CODE);
};

/**
 * Send authorization request.
 *
 * @param {OIDCRequestParamsInterface} requestParams request parameters required for authorization request.
 */
export const sendAuthorizationRequest = (requestParams) => {
    const authorizeEndpoint = getAuthorizeEndpoint();
    if (!authorizeEndpoint || authorizeEndpoint.trim().length === 0) {
        throw new Error("Invalid authorize endpoint found.");
    }
    let authorizeRequest = authorizeEndpoint + "?response_type=code&client_id="
        + requestParams.clientId;
    let scope = OIDC_SCOPE;
    if (requestParams.scope && requestParams.scope.length > 0) {
        if (!requestParams.scope.includes(OIDC_SCOPE)) {
            requestParams.scope.push(OIDC_SCOPE);
        }
        scope = requestParams.scope.join(" ");
    }
    authorizeRequest += "&scope=" + scope;
    authorizeRequest += "&redirect_uri=" + requestParams.redirectUri;
    if (requestParams.enablePKCE) {
        const codeVerifier = getCodeVerifier();
        const codeChallenge = getCodeChallenge(codeVerifier);
        setSessionParameter(PKCE_CODE_VERIFIER, codeVerifier);
        authorizeRequest += "&code_challenge_method=S256&code_challenge=" + codeChallenge;
    }
    window.location.href = authorizeRequest;
};

/**
 * Send token request.
 *
 * @param {OIDCRequestParamsInterface} requestParams request parameters required for token request.
 * @returns {Promise<TokenResponseInterface>} token response data or error.
 */
export const sendTokenRequest = (requestParams) => {
    const tokenEndpoint = getTokenEndpoint();
    if (!tokenEndpoint || tokenEndpoint.trim().length === 0) {
        return Promise.reject("Invalid token endpoint found.");
    }
    const code = new URL(window.location.href).searchParams.get(AUTHORIZATION_CODE);
    const body = [];
    body.push(`client_id=${requestParams.clientId}`);
    if (requestParams.clientSecret && requestParams.clientSecret.trim().length > 0) {
        body.push(`client_secret=${requestParams.clientSecret}`);
    }
    body.push(`code=${code}`);
    body.push("grant_type=authorization_code");
    body.push(`redirect_uri=${requestParams.redirectUri}`);
    if (requestParams.enablePKCE) {
        body.push(`code_verifier=${getSessionParameter(PKCE_CODE_VERIFIER)}`);
        removeSessionParameter(PKCE_CODE_VERIFIER);
    }
    return axios.post(tokenEndpoint, body.join("&"), getTokenRequestHeaders(requestParams.clientHost))
        .then((response) => {
        if (response.status !== 200) {
            return Promise.reject("Invalid status code received in the token response: "
                + response.status);
        }
        return validateIdToken(requestParams, response.data.id_token).then((valid) => {
            if (valid) {
                setSessionParameter(REQUEST_PARAMS, JSON.stringify(requestParams));
                const tokenResponse = {
                    accessToken: response.data.access_token,
                    expiresIn: response.data.expires_in,
                    idToken: response.data.id_token,
                    refreshToken: response.data.refresh_token,
                    scope: response.data.scope,
                    tokenType: response.data.token_type
                };
                return Promise.resolve(tokenResponse);
            }
            return Promise.reject("Invalid id_token in the token response: " + response.data.id_token);
        });
    }).catch((error) => {
        return Promise.reject(error);
    });
};

/**
 * Send refresh token request.
 *
 * @param {OIDCRequestParamsInterface} requestParams request parameters required for token request.
 * @param {string} refreshToken
 * @returns {Promise<TokenResponseInterface>} refresh token response data or error.
 */
export const sendRefreshTokenRequest = (requestParams, refreshToken) => {
    const tokenEndpoint = getTokenEndpoint();
    if (!tokenEndpoint || tokenEndpoint.trim().length === 0) {
        return Promise.reject("Invalid token endpoint found.");
    }
    const body = [];
    body.push(`client_id=${requestParams.clientId}`);
    body.push(`refresh_token=${refreshToken}`);
    body.push("grant_type=refresh_token");
    return axios.post(tokenEndpoint, body.join("&"), getTokenRequestHeaders(requestParams.clientHost))
        .then((response) => {
        if (response.status !== 200) {
            return Promise.reject("Invalid status code received in the refresh token response: "
                + response.status);
        }
        return validateIdToken(requestParams, response.data.id_token)
            .then((valid) => {
            if (valid) {
                const tokenResponse = {
                    accessToken: response.data.access_token,
                    expiresIn: response.data.expires_in,
                    idToken: response.data.id_token,
                    refreshToken: response.data.refresh_token,
                    scope: response.data.scope,
                    tokenType: response.data.token_type
                };
                return Promise.resolve(tokenResponse);
            }
            return Promise.reject("Invalid id_token in the token response: " +
                response.data.id_token);
        });
    }).catch((error) => {
        return Promise.reject(error);
    });
};

/**
 * Send revoke token request.
 *
 * @param {OIDCRequestParamsInterface} requestParams request parameters required for revoke token request.
 * @param {string} accessToken access token
 * @returns {any}
 */
export const sendRevokeTokenRequest = (requestParams, accessToken) => {
    const revokeTokenEndpoint = getRevokeTokenEndpoint();
    if (!revokeTokenEndpoint || revokeTokenEndpoint.trim().length === 0) {
        return Promise.reject("Invalid revoke token endpoint found.");
    }
    const body = [];
    body.push(`client_id=${requestParams.clientId}`);
    body.push(`token=${sessionStorage.getItem(accessToken)}`);
    body.push("token_type_hint=access_token");
    return axios.post(revokeTokenEndpoint, body.join("&"), getTokenRequestHeaders(requestParams.clientHost))
        .then((response) => {
        if (response.status !== 200) {
            return Promise.reject("Invalid status code received in the revoke token response: "
                + response.status);
        }
        return Promise.resolve("success");
    }).catch((error) => {
        return Promise.reject(error);
    });
};

/**
 * Get authenticated user from the id_token.
 *
 * @param idToken id_token received from the IdP.
 * @returns {AuthenticatedUserInterface} authenticated user.
 */
export const getAuthenticatedUser = (idToken) => {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return {
        displayName: payload.preferred_username ? payload.preferred_username : payload.sub,
        email: payload.email ? payload.email : null,
        username: payload.sub,
    };
};

/**
 * Validate id_token.
 *
 * @param {OIDCRequestParamsInterface} requestParams request params.
 * @param {string} idToken id_token received from the IdP.
 * @returns {Promise<boolean>} whether token is valid.
 */
const validateIdToken = (requestParams, idToken) => {
    const jwksEndpoint = getJwksUri();
    if (!jwksEndpoint || jwksEndpoint.trim().length === 0) {
        return Promise.reject("Invalid JWKS URI found.");
    }
    return axios.get(jwksEndpoint)
        .then((response) => {
        if (response.status !== 200) {
            return Promise.reject("Failed to load public keys from JWKS URI: "
                + jwksEndpoint);
        }
        const jwk = getJWKForTheIdToken(idToken.split(".")[0], response.data.keys);
        return Promise.resolve(isValidIdToken(idToken, jwk, requestParams.clientId));
    }).catch((error) => {
        return Promise.reject(error);
    });
};

/**
 * Get token request headers.
 *
 * @param {string} clientHost
 * @returns {{headers: {Accept: string; "Access-Control-Allow-Origin": string; "Content-Type": string}}}
 */
const getTokenRequestHeaders = (clientHost) => {
    return {
        headers: {
            "Accept": "application/json",
            "Access-Control-Allow-Origin": clientHost,
            "Content-Type": "application/x-www-form-urlencoded"
        }
    };
};
