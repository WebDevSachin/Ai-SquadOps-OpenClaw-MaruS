/**
 * CDN Infrastructure for SquadOps SST
 * CloudFront distribution
 */
import * as aws from "@pulumi/aws";
import { alb } from "./cluster";

const stage = $app.stage;
const isProd = stage === "production";

// Get domain from config (optional)
const domainName = process.env.DOMAIN_NAME;

// CloudFront Origin Request Policy
const originRequestPolicy = new aws.cloudfront.OriginRequestPolicy(`squadops-origin-policy-${stage}`, {
  headersConfig: {
    headerBehavior: "whitelist",
    headers: {
      items: ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method", "Authorization"],
    },
  },
  cookiesConfig: {
    cookieBehavior: "all",
  },
  queryStringsConfig: {
    queryStringBehavior: "all",
  },
});

// Cache Policy for API (no caching)
const apiCachePolicy = new aws.cloudfront.CachePolicy(`squadops-api-cache-${stage}`, {
  defaultTtl: 0,
  maxTtl: 0,
  minTtl: 0,
  parametersInCacheKeyAndForwardedToOrigin: {
    enableAcceptEncodingGzip: true,
    headersConfig: {
      headerBehavior: "whitelist",
      headers: {
        items: ["Authorization"],
      },
    },
    cookiesConfig: {
      cookieBehavior: "all",
    },
    queryStringsConfig: {
      queryStringBehavior: "all",
    },
  },
});

// Cache Policy for static assets
const staticCachePolicy = new aws.cloudfront.CachePolicy(`squadops-static-cache-${stage}`, {
  defaultTtl: 86400,
  maxTtl: 31536000,
  minTtl: 1,
  parametersInCacheKeyAndForwardedToOrigin: {
    enableAcceptEncodingGzip: true,
    headersConfig: {
      headerBehavior: "none",
    },
    cookiesConfig: {
      cookieBehavior: "none",
    },
    queryStringsConfig: {
      queryStringBehavior: "none",
    },
  },
});

// Origin Access Identity
const oai = new aws.cloudfront.OriginAccessIdentity(`squadops-oai-${stage}`, {
  comment: `SquadOps ${stage}`,
});

// CloudFront Distribution
export const cdn = new aws.cloudfront.Distribution(`squadops-cdn-${stage}`, {
  enabled: true,
  httpVersion: "http3",
  priceClass: "PriceClass_100",
  defaultRootObject: "index.html",
  origins: [{
    domainName: alb.dnsName,
    originId: "alb",
    customOriginConfig: {
      httpPort: 80,
      httpsPort: 443,
      originProtocolPolicy: "http-only",
      originSslProtocols: {
        items: ["TLSv1.2"],
        quantity: 1,
      },
    },
    customHeaders: [{
      name: "X-Origin-Verify",
      value: oai.cloudfrontAccessIdentityPath,
    }],
  }],
  defaultCacheBehavior: {
    allowedMethods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],
    targetOriginId: "alb",
    viewerProtocolPolicy: "redirect-to-https",
    cachePolicyId: staticCachePolicy.id,
    originRequestPolicyId: originRequestPolicy.id,
    compress: true,
  },
  orderedCacheBehaviors: [
    {
      pathPattern: "/api/*",
      allowedMethods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
      cachedMethods: ["GET", "HEAD"],
      targetOriginId: "alb",
      viewerProtocolPolicy: "https-only",
      cachePolicyId: apiCachePolicy.id,
      originRequestPolicyId: originRequestPolicy.id,
      compress: true,
    },
    {
      pathPattern: "/openclaw/*",
      allowedMethods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
      cachedMethods: ["GET", "HEAD"],
      targetOriginId: "alb",
      viewerProtocolPolicy: "https-only",
      cachePolicyId: apiCachePolicy.id,
      originRequestPolicyId: originRequestPolicy.id,
      compress: true,
    },
    {
      pathPattern: "/_next/static/*",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      targetOriginId: "alb",
      viewerProtocolPolicy: "redirect-to-https",
      cachePolicyId: staticCachePolicy.id,
      compress: true,
    },
    {
      pathPattern: "/static/*",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      targetOriginId: "alb",
      viewerProtocolPolicy: "redirect-to-https",
      cachePolicyId: staticCachePolicy.id,
      compress: true,
    },
  ],
  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
  loggingConfig: {
    includeCookies: false,
    bucket: new aws.s3.Bucket(`squadops-cdn-logs-${stage}`, {
      acl: "private",
      lifecycleRules: [{
        id: "expire-logs",
        enabled: true,
        expiration: {
          days: 30,
        },
      }],
    }).bucketDomainName,
    prefix: "cdn-logs/",
  },
  tags: {
    Name: `squadops-cdn-${stage}`,
  },
});

// Outputs
export const cdnDomain = cdn.domainName;
export const cdnUrl = cdn.domainName.apply((d) => `https://${d}`);
