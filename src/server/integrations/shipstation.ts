export interface ShipStationConnector {
  syncShipments(orgId: string): Promise<{ count: number }>;
}

export function createShipStationConnector(): ShipStationConnector {
  return {
    async syncShipments(orgId: string) {
      console.log(`[shipstation-stub] TODO: replace with real ShipStation API client (org=${orgId}).`);
      return { count: 0 };
    },
  };
}
