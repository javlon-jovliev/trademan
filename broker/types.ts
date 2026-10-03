export type BrokerPosition = {
  conid: string;
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number | null;
  previousClose: number | null;
  multiplier: number;
  fx: number | null;
  currency: string;
  assetClass: string;
  sector: string;
};
export type BrokerSnapshot = {
  brokerId: string;
  currency: string;
  nlv: number | null;
  cash: number | null;
  buyingPower: number | null;
  maintenanceMargin: number | null;
  excessLiquidity: number | null;
  positions: BrokerPosition[];
};
export interface BrokerAdapter {
  snapshot(accountId: string): Promise<BrokerSnapshot>;
}
