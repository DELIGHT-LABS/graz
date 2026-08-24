import type { SessionTypes } from "@walletconnect/types";

export type ApprovedCosmosAccount = {
  address: string;
  chainId: string;
};

export type ApprovedCosmosScope = {
  accounts: ApprovedCosmosAccount[];
  chainIds: string[];
  events: string[];
  methods: string[];
};

const getCosmosChainId = (caipChainId: string): string | undefined => {
  const [namespace, chainId] = caipChainId.split(":");
  if (namespace !== "cosmos" || !chainId) return;
  return chainId;
};

const getCosmosAccount = (caipAccount: string): ApprovedCosmosAccount | undefined => {
  const [namespace, chainId, ...addressParts] = caipAccount.split(":");
  const address = addressParts.join(":");
  if (namespace !== "cosmos" || !chainId || !address) return;
  return { address, chainId };
};

export const getApprovedCosmosScope = (session: SessionTypes.Struct): ApprovedCosmosScope => {
  const namespace = session.namespaces.cosmos;
  const accounts = (namespace?.accounts ?? [])
    .map(getCosmosAccount)
    .filter((account): account is ApprovedCosmosAccount => account !== undefined);
  const chainIds = new Set(
    (namespace?.chains ?? []).map(getCosmosChainId).filter((chainId): chainId is string => chainId !== undefined),
  );

  for (const account of accounts) chainIds.add(account.chainId);

  return {
    accounts,
    chainIds: [...chainIds],
    events: namespace?.events ?? [],
    methods: namespace?.methods ?? [],
  };
};

export const isApprovedCosmosAccount = (session: SessionTypes.Struct, chainId: string, address: string): boolean =>
  getApprovedCosmosScope(session).accounts.some(
    (account) => account.chainId === chainId && account.address === address,
  );

export const sessionApprovesCosmos = (session: SessionTypes.Struct, chainIds: string[], method?: string): boolean => {
  const scope = getApprovedCosmosScope(session);
  return chainIds.every((chainId) => scope.chainIds.includes(chainId)) && (!method || scope.methods.includes(method));
};

export const isWalletConnectSessionActive = (session: SessionTypes.Struct, now = Date.now()): boolean =>
  session.expiry * 1000 > now + 1000;

export const findApprovedCosmosSession = (
  sessions: SessionTypes.Struct[],
  chainIds: string[],
  method?: string,
  now = Date.now(),
): SessionTypes.Struct | undefined =>
  [...sessions]
    .reverse()
    .find((session) => isWalletConnectSessionActive(session, now) && sessionApprovesCosmos(session, chainIds, method));
