import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type DevProxyConfig = {
	debug?: boolean;
	disable?: boolean;
	// Remote server to be used
	remoteUrl: string | ((request: NextRequest) => string);

	// if set to true accept-encoding header will be forwarded
	// this could cause encoding issues
	allowResponseCompression?: boolean;

	overrideHostHeader?: boolean;
	overrideCookieDomain?: false | string;

	// Basic Auth
	basicAuth?: {
		// will be used as the "Authorization" header
		authHeader: string;
	};
	// Cloudflare Access Token Authorization
	cfTokenAuth?: {
		clientId: string;
		clientSecret: string;
	};
};

/**
 * Place this snippet inside your `middleware.ts` file:
 *
 * 	export function middleware(request: NextRequest) {
 * 		if (request.nextUrl.pathname.match('^/(services|webhooks)/')) {
 * 			return proxyMiddleware(request);
 * 		}
 * 		return request
 * 	}
 *
 *  export const config = {
 * 		matcher: ['/services/:path*'],
 *  };
 *
 * @param request
 */
export const createProxyMiddleware = (config: DevProxyConfig) => {
	if (config.debug) {
		console.log("[PROXY]", "starting proxy with config", config);
	}

	if (config.remoteUrl === undefined) {
		throw new Error("remoteUrl is required");
	}

	return async (request: NextRequest) => {
		if (config.disable) {
			return request;
		}

		const remoteUrl = new URL(
			typeof config.remoteUrl === "function"
				? config.remoteUrl(request)
				: config.remoteUrl,
		);
		remoteUrl.pathname = request.nextUrl.pathname;
		remoteUrl.search = request.nextUrl.search;

		const remoteHeaders = new Headers(request.headers);
		remoteHeaders.set("host", remoteUrl.host);

		if (config.basicAuth) {
			remoteHeaders.set("Authorization", config.basicAuth.authHeader);
		}

		// disable compression for proxy
		remoteHeaders.delete("accept-encoding");

		console.log("[PROXY]", `${request.nextUrl.href} => ${remoteUrl.href}`);
		// check if we have cloudflare headers
		if (config.cfTokenAuth) {
			remoteHeaders.set("CF-Access-Client-Id", config.cfTokenAuth.clientId);
			remoteHeaders.set(
				"CF-Access-Client-Secret",
				config.cfTokenAuth.clientSecret,
			);
		}

		// Fetch the response from the backend
		const backendResponse = await fetch(remoteUrl.href, {
			method: request.method,
			headers: remoteHeaders,
			body: request.body,
		});

		if (config.debug) {
			console.log("[PROXY]", "received response from remote", {
				// biome-ignore lint/suspicious/noExplicitAny: inconsistency in TS
				headers: Object.fromEntries(backendResponse.headers as any),
			});
		}

		const responseHeaders = new Headers(backendResponse.headers);
		if (config.overrideCookieDomain) {
			const setCookieHeaders = backendResponse.headers.get("set-cookie");
			if (setCookieHeaders) {
				try {
					if (config.debug) {
						console.log("[PROXY]", "setCookieHeaders", setCookieHeaders);
					}
					// const origin = new URL(request.headers.get("host") ?? "");
					const rewrittenCookies = setCookieHeaders.split(",").map((cookie) => {
						const [cookiePair] = cookie.split(";").map((part) => part.trim());
						return `${cookiePair}; Path=/; SameSite=None; Secure; Domain=${config.overrideCookieDomain}`;
					});

					if (config.debug) {
						console.log("[PROXY]", "rewrittenCookies", rewrittenCookies);
					}
					remoteHeaders.set("set-cookie", rewrittenCookies.join(","));
				} catch (e) {
					console.error("Error setting cookies", e);
				}
			}
		}

		const response = new NextResponse(backendResponse.body, {
			...backendResponse,
			headers: responseHeaders,
			status: backendResponse.status,
		});

		return response;
	};
};
