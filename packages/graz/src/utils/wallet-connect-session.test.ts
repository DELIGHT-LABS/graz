import type { SessionTypes } from "@walletconnect/types";
import { describe, expect, it } from "vitest";

import {
  findApprovedCosmosSession,
  getApprovedCosmosScope,
  isApprovedCosmosAccount,
  sessionApprovesCosmos,
} from "./wallet-connect-session";

const makeSession = ({
  accounts,
  chains,
  expiry = Math.floor(Date.now() / 1000) + 60,
  methods = ["cosmos_getAccounts", "cosmos_signDirect"],
  requiredChains = ["cosmos:proposal-only-1"],
  topic,
}: {
  accounts: string[];
  chains?: string[];
  expiry?: number;
  methods?: string[];
  requiredChains?: string[];
  topic: string;
}): SessionTypes.Struct =>
  ({
    expiry,
    namespaces: {
      cosmos: {
        accounts,
        chains,
        events: ["accountsChanged"],
        methods,
      },
    },
    requiredNamespaces: {
      cosmos: {
        chains: requiredChains,
        events: [],
        methods: [],
      },
    },
    topic,
  }) as unknown as SessionTypes.Struct;

describe("WalletConnect approved Cosmos scope", () => {
  it("derives chains and accounts only from the approved namespace", () => {
    const session = makeSession({
      accounts: ["cosmos:osmosis-1:osmo1approved"],
      topic: "approved",
    });

    expect(getApprovedCosmosScope(session)).toMatchObject({
      accounts: [{ address: "osmo1approved", chainId: "osmosis-1" }],
      chainIds: ["osmosis-1"],
    });
    expect(sessionApprovesCosmos(session, ["osmosis-1"], "cosmos_signDirect")).toBe(true);
    expect(sessionApprovesCosmos(session, ["proposal-only-1"])).toBe(false);
    expect(isApprovedCosmosAccount(session, "osmosis-1", "osmo1approved")).toBe(true);
    expect(isApprovedCosmosAccount(session, "osmosis-1", "osmo1other")).toBe(false);
  });

  it("selects the newest non-expired session that approves every requested chain", () => {
    const now = Date.now();
    const matching = makeSession({
      accounts: ["cosmos:cosmoshub-4:cosmos1approved", "cosmos:osmosis-1:osmo1approved"],
      chains: ["cosmos:cosmoshub-4", "cosmos:osmosis-1"],
      topic: "matching",
    });
    const partial = makeSession({
      accounts: ["cosmos:cosmoshub-4:cosmos1newer"],
      chains: ["cosmos:cosmoshub-4"],
      topic: "partial",
    });
    const expired = makeSession({
      accounts: ["cosmos:cosmoshub-4:cosmos1expired", "cosmos:osmosis-1:osmo1expired"],
      chains: ["cosmos:cosmoshub-4", "cosmos:osmosis-1"],
      expiry: Math.floor(now / 1000) - 1,
      topic: "expired",
    });

    expect(
      findApprovedCosmosSession([matching, partial, expired], ["cosmoshub-4", "osmosis-1"], "cosmos_signDirect", now)
        ?.topic,
    ).toBe("matching");
  });

  it("does not select a session that omitted the requested method", () => {
    const session = makeSession({
      accounts: ["cosmos:cosmoshub-4:cosmos1approved"],
      methods: ["cosmos_signAmino"],
      topic: "amino-only",
    });

    expect(findApprovedCosmosSession([session], ["cosmoshub-4"], "cosmos_signDirect")).toBeUndefined();
    expect(findApprovedCosmosSession([session], ["cosmoshub-4"], "cosmos_signAmino")?.topic).toBe("amino-only");
  });
});
