export type RechargeTemplate = {
  id: string;
  name: string;
  /** 与前台 Store UI 对齐：美元价格 */
  priceUsd: number;
  /** 可选：充值得到的金币数量（演示字段，前台未必使用） */
  coins?: number;
  /** 是否可用 */
  enabled: boolean;
  /** 排序权重（越小越靠前） */
  sort: number;
  createdAt: string;
  updatedAt: string;
};

export type AccessListConfig = {
  whitelistClientIds: string[];
  blacklistClientIds: string[];
  updatedAt: string;
};

export type AdminAssetConfig = {
  rechargeTemplates: RechargeTemplate[];
  accessList: AccessListConfig;
  updatedAt: string;
};

