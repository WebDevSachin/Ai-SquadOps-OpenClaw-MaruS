/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "squadops",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    const infra = await import("./infra");
    
    // Export stack outputs
    return {
      vpcId: infra.vpc.id,
      clusterName: infra.cluster.name,
      databaseHost: infra.database.host,
      redisHost: infra.redis.host,
      apiUrl: infra.api.url,
      dashboardUrl: infra.dashboard.url,
      cdnUrl: infra.cdn.url,
    };
  },
});
