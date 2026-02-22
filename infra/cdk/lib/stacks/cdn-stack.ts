/**
 * CDN Stack for SquadOps
 * Creates CloudFront distribution and Route53 records
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53_targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SquadOpsConfig } from '../config';

export interface CdnStackProps extends cdk.StackProps {
  albDnsName: string;
  domainName?: string;
  hostedZoneId?: string;
}

export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly certificate?: acm.Certificate;

  constructor(scope: Construct, id: string, config: SquadOpsConfig, props: CdnStackProps) {
    super(scope, id, props);

    let domainNames: string[] = [];
    let certificate: acm.ICertificate | undefined;

    // Configure custom domain if provided
    if (props.domainName && props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        zoneName: props.domainName,
        hostedZoneId: props.hostedZoneId,
      });

      domainNames = [props.domainName, `*.${props.domainName}`];

      // Create ACM certificate
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: props.domainName,
        subjectAlternativeNames: [`*.${props.domainName}`],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      certificate = this.certificate;
    }

    // Origin request policy for API forwarding
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginPolicy', {
      originRequestPolicyName: `${config.projectName}-api-policy`,
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Origin',
        'Access-Control-Request-Headers',
        'Access-Control-Request-Method',
        'Authorization'
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
    });

    // Cache policy for API (no caching)
    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `${config.projectName}-api-cache`,
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    });

    // Cache policy for static assets
    const staticCachePolicy = new cloudfront.CachePolicy(this, 'StaticCachePolicy', {
      cachePolicyName: `${config.projectName}-static-cache`,
      defaultTtl: cdk.Duration.days(30),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(1),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    });

    // Create CloudFront distribution
    const albOrigin = new cloudfront_origins.HttpOrigin(props.albDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      customHeaders: {
        'X-Origin-Verify': cdk.Fn.base64(cdk.Stack.of(this).stackId),
      },
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: albOrigin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: albOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
        },
        '/openclaw/*': {
          origin: albOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        '/_next/static/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
        '/static/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
        },
      },
      domainNames: domainNames.length > 0 ? domainNames : undefined,
      certificate: certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      logBucket: new s3.Bucket(this, 'LogsBucket', {
        bucketName: `${config.projectName}-${config.environment}-cdn-logs-${this.account}`,
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(30),
          },
        ],
      }),
      logFilePrefix: 'cdn-access-logs/',
    });

    // Create Route53 records if domain is configured
    if (props.domainName && props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        zoneName: props.domainName,
        hostedZoneId: props.hostedZoneId,
      });

      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53_targets.CloudFrontTarget(this.distribution)
        ),
      });

      new route53.AaaaRecord(this, 'AliasRecordIPv6', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53_targets.CloudFrontTarget(this.distribution)
        ),
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    if (props.domainName) {
      new cdk.CfnOutput(this, 'CustomDomain', {
        value: props.domainName,
        description: 'Custom Domain Name',
      });
    }
  }
}
