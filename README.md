![npm](https://img.shields.io/npm/dm/@foomo/next-proxy-middleware.svg?style=flat-square)
![npm](https://img.shields.io/npm/l/@foomo/next-proxy-middleware.svg?style=flat-square)
[![Build Status](https://github.com/foomo/next-proxy-middleware/actions/workflows/test.yml/badge.svg?branch=main&event=push)](https://github.com/foomo/next-proxy-middleware/actions/workflows/test.yml)

# @foomo/next-proxy-middleware

A Next.js middleware for proxying requests to external services with advanced configuration options.

## Installation

```bash
npm install @foomo/next-proxy-middleware
```

## Usage

Import the middleware and configuration type in your Next.js middleware file:

```typescript
import {
  createProxyMiddleware,
  DevProxyConfig,
} from "@foomo/next-proxy-middleware";
```

## Configuration

The `DevProxyConfig` type defines the following options:

```typescript
export type DevProxyConfig = {
  debug?: boolean; // Enable debug logging
  disable?: boolean; // Disable the proxy entirely
  remoteUrl: string | ((request: NextRequest) => string); // Remote URL or function to generate it
  overrideCookieDomain?: false | string; // Domain to use for cookies or false to disable
  basicAuth?: {
    authHeader: string; // Authorization header value
  };
  cfTokenAuth?: {
    clientId: string;
    clientSecret: string;
  };
  rewriteRequestHeaders?: (
    originalRequest: Headers,
    preparedHeaders: Headers
  ) => Headers;
  rewriteResponseHeaders?: (
    backendResponse: Headers,
    preparedHeaders: Headers
  ) => Headers;
};
```

## Example

Here's an example of how to use the middleware in your `middleware.ts` file:

```typescript
import {
  createProxyMiddleware,
  DevProxyConfig,
} from "@foomo/next-proxy-middleware";

const proxyConfig: DevProxyConfig = {
  remoteUrl: "https://api.example.com",
  basicAuth: {
    authHeader: "Basic abc123==",
  },
  overrideCookieDomain: "localhost",
};

const proxyMiddleware = createProxyMiddleware(proxyConfig);

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.match("^/(api|webhooks)/")) {
    return proxyMiddleware(request);
  }
  return request;
}

export const config = {
  matcher: ["/api/:path*"],
};
```

### Header Customization

You can customize request and response headers using the `rewriteRequestHeaders` and `rewriteResponseHeaders` hooks:

```typescript
const proxyConfig: DevProxyConfig = {
  remoteUrl: "https://api.example.com",
  overrideCookieDomain: "localhost",

  // Modify headers before sending to backend
  rewriteRequestHeaders: (originalRequest, preparedHeaders) => {
    preparedHeaders.set("X-Custom-Header", "value");
    return preparedHeaders;
  },

  // Modify headers before sending to client
  rewriteResponseHeaders: (backendResponse, preparedHeaders) => {
    preparedHeaders.set("Access-Control-Allow-Origin", "http://localhost:3000");
    return preparedHeaders;
  },
};
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

Distributed under MIT License, please see license file within the code for more details.

_Made with love by [foomo](https://www.foomo.org) at [bestbytes](https://www.bestbytes.com)_
