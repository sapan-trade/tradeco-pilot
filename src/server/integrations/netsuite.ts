export interface NetSuiteConnector {
  syncItems(orgId: string): Promise<{ count: number }>;
}

export function createNetSuiteConnector(): NetSuiteConnector {
  return {
    async syncItems(orgId: string) {
      console.log(`[netsuite-stub] TODO: replace with real NetSuite SuiteTalk client (org=${orgId}).`);
      return { count: 0 };
    },
  };
}
