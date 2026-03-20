import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Configuration options for the development proxy middleware.
 */
export type DevProxyConfig = {
	/**
	 * Enable detailed logging of proxy operations.
	 * Logs request/response headers, cookies, and transformations.
	 *
	 * @default false
	 */
	debug?: boolean;

	/**
	 * Completely disable the proxy.
	 * Useful for production builds where you want to disable proxying.
	 *
	 * @default false
	 */
	disable?: boolean;

	/**
	 * The remote backend server URL to proxy requests to.
	 * Can be a static string or a function that returns a URL based on the request.
	 *
	 * @example
	 * ```ts
	 * // Static URL
	 * remoteUrl: 'https://dev.example.com'
	 *
	 * // Dynamic URL based on request
	 * remoteUrl: (request) => {
	 *   return request.headers.get('x-tenant') === 'admin'
	 *     ? 'https://admin-api.example.com'
	 *     : 'https://api.example.com';
	 * }
	 * ```
	 */
	remoteUrl: string | ((request: NextRequest) => string);

	/**
	 * Automatically rewrite cookie Domain attributes in Set-Cookie headers.
	 *
	 * When proxying to a remote backend (e.g., dev.example.com) but running locally
	 * (e.g., localhost:3000), cookies with Domain=example.com won't work. This option
	 * rewrites them to your local domain.
	 *
	 * Also converts SameSite=Strict to SameSite=None for cross-domain compatibility.
	 *
	 * @example
	 * ```ts
	 * // For local development
	 * overrideCookieDomain: 'localhost'
	 *
	 * // For custom local domain
	 * overrideCookieDomain: 'myapp.local.gd'
	 *
	 * // Disable cookie rewriting
	 * overrideCookieDomain: false
	 * ```
	 *
	 * @default false
	 */
	overrideCookieDomain?: false | string;

	/**
	 * Add HTTP Basic Authentication to requests sent to the backend.
	 *
	 * @example
	 * ```ts
	 * basicAuth: {
	 *   authHeader: 'Basic ' + btoa('username:password')
	 * }
	 * ```
	 */
	basicAuth?: {
		/** The complete Authorization header value (e.g., "Basic base64string") */
		authHeader: string;
	};

	/**
	 * Add Cloudflare Access authentication headers to requests.
	 *
	 * Used when your backend is protected by Cloudflare Access.
	 *
	 * @example
	 * ```ts
	 * cfTokenAuth: {
	 *   clientId: process.env.CF_CLIENT_ID,
	 *   clientSecret: process.env.CF_CLIENT_SECRET
	 * }
	 * ```
	 */
	cfTokenAuth?: {
		/** Cloudflare Access Client ID */
		clientId: string;
		/** Cloudflare Access Client Secret */
		clientSecret: string;
	};

	/**
	 * Customize request headers before sending to the remote backend.
	 *
	 * This hook is called after the proxy has prepared the request headers but before
	 * sending the request to the remote server. Use this to add, modify, or remove
	 * headers that should be sent to your backend.
	 *
	 * @param originalRequest - The original incoming request headers from the client
	 * @param preparedHeaders - Headers prepared by the proxy (with host, auth, etc. already set)
	 * @returns The final headers to send to the remote backend
	 *
	 * @example
	 * ```ts
	 * rewriteRequestHeaders: (originalRequest, preparedHeaders) => {
	 *   // Add custom header
	 *   preparedHeaders.set('X-Custom-Header', 'value');
	 *
	 *   // Forward specific client headers
	 *   const userAgent = originalRequest.get('user-agent');
	 *   if (userAgent) {
	 *     preparedHeaders.set('X-Original-User-Agent', userAgent);
	 *   }
	 *
	 *   return preparedHeaders;
	 * }
	 * ```
	 */
	rewriteRequestHeaders?: (
		originalRequest: Headers,
		preparedHeaders: Headers,
	) => Headers;

	/**
	 * Customize response headers before sending to the client.
	 *
	 * This hook is called after the proxy receives the response from the remote server
	 * and after automatic cookie domain rewriting (if configured). Use this to add,
	 * modify, or remove headers in the response to the client.
	 *
	 * @param backendResponse - The original response headers from the remote backend
	 * @param preparedHeaders - Headers prepared by the proxy (with cookies rewritten, etc.)
	 * @returns The final headers to send to the client
	 *
	 * @example
	 * ```ts
	 * rewriteResponseHeaders: (backendResponse, preparedHeaders) => {
	 *   // Add CORS headers for local development
	 *   preparedHeaders.set('Access-Control-Allow-Origin', 'http://localhost:3000');
	 *   preparedHeaders.set('Access-Control-Allow-Credentials', 'true');
	 *
	 *   // Remove security headers that break local dev
	 *   preparedHeaders.delete('Content-Security-Policy');
	 *
	 *   // Forward timing information from backend
	 *   const timing = backendResponse.get('Server-Timing');
	 *   if (timing) {
	 *     preparedHeaders.set('Server-Timing', timing);
	 *   }
	 *
	 *   return preparedHeaders;
	 * }
	 * ```
	 */
	rewriteResponseHeaders?: (
		backendResponse: Headers,
		preparedHeaders: Headers,
	) => Headers;
};

/**
 * Creates a Next.js middleware that proxies requests to a remote backend server.
 *
 * This is useful for local development when you want to use a remote backend (dev/staging)
 * instead of running the backend locally. The proxy handles authentication, cookie rewriting,
 * and header manipulation automatically.
 *
 * ## Request/Response Flow
 *
 * **Request (Client → Backend):**
 * 1. Prepare headers: Set host, auth, remove compression
 * 2. Apply `rewriteRequestHeaders` hook (if configured)
 * 3. Send request to remote backend
 *
 * **Response (Backend → Client):**
 * 4. Prepare headers: Copy backend response headers
 * 5. Apply automatic cookie domain rewriting (if `overrideCookieDomain` is set)
 * 6. Apply `rewriteResponseHeaders` hook (if configured)
 * 7. Send response to client
 *
 * @param config - Proxy configuration
 * @returns A Next.js middleware function
 *
 * @example Basic usage in middleware.ts
 * ```ts
 * import { createProxyMiddleware } from '@foomo/next-proxy-middleware';
 *
 * const proxyMiddleware = createProxyMiddleware({
 *   remoteUrl: 'https://api.example.com',
 *   overrideCookieDomain: 'localhost',
 *   debug: true,
 * });
 *
 * export function middleware(request: NextRequest) {
 *   if (request.nextUrl.pathname.startsWith('/api/')) {
 *     return proxyMiddleware(request);
 *   }
 * }
 *
 * export const config = {
 *   matcher: ['/api/:path*'],
 * };
 * ```
 *
 * @example With header customization
 * ```ts
 * const proxyMiddleware = createProxyMiddleware({
 *   remoteUrl: 'https://dev.example.com',
 *   overrideCookieDomain: 'localhost',
 *
 *   rewriteRequestHeaders: (original, prepared) => {
 *     // Add API key for backend
 *     prepared.set('X-API-Key', process.env.DEV_API_KEY);
 *     return prepared;
 *   },
 *
 *   rewriteResponseHeaders: (backend, prepared) => {
 *     // Add CORS for local development
 *     prepared.set('Access-Control-Allow-Origin', 'http://localhost:3000');
 *     return prepared;
 *   },
 * });
 * ```
 */
export const createProxyMiddleware = (config: DevProxyConfig) => {
	if (config.debug) {
		console.debug("[PROXY]", "starting proxy with config", config);
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

		// Prepare request headers for the backend
		const preparedRequestHeaders = new Headers(request.headers);
		preparedRequestHeaders.set("host", remoteUrl.host);

		if (config.basicAuth) {
			preparedRequestHeaders.set("Authorization", config.basicAuth.authHeader);
		}

		// Disable compression for proxy (compressed responses can cause parsing issues)
		preparedRequestHeaders.delete("accept-encoding");

		// Add Cloudflare Access Token headers if configured
		if (config.cfTokenAuth) {
			preparedRequestHeaders.set(
				"CF-Access-Client-Id",
				config.cfTokenAuth.clientId,
			);
			preparedRequestHeaders.set(
				"CF-Access-Client-Secret",
				config.cfTokenAuth.clientSecret,
			);
		}

		// Apply custom request header rewriting (if configured)
		const finalRequestHeaders =
			config.rewriteRequestHeaders?.(request.headers, preparedRequestHeaders) ??
			preparedRequestHeaders;

		if (config.debug) {
			console.debug(
				"[PROXY]",
				"rewriteRequest cookies:",
				finalRequestHeaders.get("cookie"),
			);
			console.debug("[PROXY]", "Preparing fetch request:", {
				url: remoteUrl.href,
				method: request.method,
				headers: Object.fromEntries(finalRequestHeaders as any),
				hasBody: request.body !== null,
			});
		}

		// Send request to the backend
		const startTime = performance.now();
		try {
			const backendResponse = await fetch(remoteUrl.href, {
				method: request.method,
				headers: finalRequestHeaders,
				body: request.body,
			});
			const duration = performance.now() - startTime;

			console.log(
				"[PROXY]",
				request.method,
				`${request.nextUrl.pathname} => ${remoteUrl.href}`,
				backendResponse.status,
				`${duration.toFixed(0)}ms`,
			);

			if (config.debug) {
				console.debug("[PROXY]", "received response from remote", {
					headers: Object.fromEntries(backendResponse.headers as any),
				});
			}

			// Prepare response headers for the client
			const preparedResponseHeaders = new Headers(backendResponse.headers);

			if (config.debug) {
				console.debug(
					"[PROXY]",
					"rewriteResponse cookies:",
					backendResponse.headers.get("set-cookie"),
				);
			}

			// Apply automatic cookie domain rewriting (if configured)
			// This rewrites cookies from the production domain to your local development domain
			if (config.overrideCookieDomain) {
				const setCookieHeaders = backendResponse.headers.getSetCookie();
				if (setCookieHeaders.length > 0) {
					try {
						if (config.debug) {
							console.debug(
								"[PROXY]",
								"original set-cookie headers:",
								setCookieHeaders,
							);
						}

						// Clear existing set-cookie headers and add rewritten ones
						preparedResponseHeaders.delete("set-cookie");

						for (const cookie of setCookieHeaders) {
							// Replace Domain attribute while preserving all other attributes
							// (Path, Max-Age, HttpOnly, Secure, etc.)
							const rewritten = cookie
								.replace(
									/Domain=[^;]+/gi,
									`Domain=${config.overrideCookieDomain}`,
								)
								// Change SameSite=Strict to SameSite=None for cross-origin dev
								.replace(/SameSite=Strict/gi, "SameSite=None");

							preparedResponseHeaders.append("set-cookie", rewritten);
						}

						if (config.debug) {
							console.debug(
								"[PROXY]",
								"rewritten cookies:",
								preparedResponseHeaders.getSetCookie(),
							);
						}
					} catch (e) {
						console.error("[PROXY] Error rewriting cookies", e);
					}
				}
			}

			// Apply custom response header rewriting (if configured)
			const finalHeaders =
				config.rewriteResponseHeaders?.(
					backendResponse.headers,
					preparedResponseHeaders,
				) ?? preparedResponseHeaders;

			return new NextResponse(backendResponse.body, {
				...backendResponse,
				headers: finalHeaders,
				status: backendResponse.status,
			});
		} catch (error) {
			console.error("[PROXY]", "Error during proxy request:", {
				error:
					error instanceof Error
						? {
								message: error.message,
								name: error.name,
								stack: error.stack,
								cause: error.cause,
							}
						: error,
				url: remoteUrl.href,
				method: request.method,
				headers: Object.fromEntries(finalRequestHeaders as any),
			});

			// Return error response to client
			return new NextResponse(
				JSON.stringify({
					error: "Proxy request failed",
					message: error instanceof Error ? error.message : "Unknown error",
					url: remoteUrl.href,
				}),
				{
					status: 502,
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}
	};
};
