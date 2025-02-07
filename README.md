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
  allowResponseCompression?: boolean; // Allow response compression (default: false)
  overrideHostHeader?: boolean; // Override host header (default: true)
  overrideCookieDomain?: false | string; // Domain to use for cookies or false to disable
  basicAuth?: {
    authHeader: string; // Authorization header value
  };
  cfTokenAuth?: {
    clientId: string;
    clientSecret: string;
  };
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
  overrideCookieDomain: "example.com",
};

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.match("^/(api|webhooks)/")) {
    return proxyMiddleware(request);
  }
  return request;
}

export const config = {
  matcher: ["/api/:path*"],
};

const proxyMiddleware = createProxyMiddleware(proxyConfig);
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

MIT License
