import { tool } from "ai";
import { z } from "zod";
import type { PanosClient } from "./client";
import {
  DEFAULT_MAX_TOOL_OUTPUT_CHARS,
  MAX_LOG_QUERY_LENGTH,
  MAX_LOGS,
} from "../security";

const VSYS_BASE = `/config/devices/entry[@name='localhost.localdomain']/vsys/entry[@name='vsys1']`;

export type CreatePanosToolsOptions = {
  includeLogTools: boolean;
  maxToolOutputChars: number;
  maxLogsPerQuery: number;
};

function makeLogParams(maxLogsCap: number) {
  const defaultLogs = Math.min(20, maxLogsCap);
  return {
    filter: z
      .string()
      .max(MAX_LOG_QUERY_LENGTH)
      .optional()
      .describe("PAN-OS log filter query, e.g. '( addr.src in 10.0.0.0/8 )'"),
    maxLogs: z
      .number()
      .int()
      .min(1)
      .max(maxLogsCap)
      .optional()
      .default(defaultLogs),
  };
}

export function createPanosTools(
  client: PanosClient,
  options?: Partial<CreatePanosToolsOptions>
) {
  const includeLogTools = options?.includeLogTools ?? true;
  const maxToolOutputChars =
    options?.maxToolOutputChars ?? DEFAULT_MAX_TOOL_OUTPUT_CHARS;
  const maxLogsPerQuery = Math.min(
    options?.maxLogsPerQuery ?? MAX_LOGS,
    MAX_LOGS
  );

  const logParams = makeLogParams(maxLogsPerQuery);

  function truncateToolJson(json: string): string {
    if (json.length <= maxToolOutputChars) return json;
    const suffix =
      "\n\n[Output truncated for size; narrow the query or ask for a specific slice.]";
    const take = Math.max(0, maxToolOutputChars - suffix.length);
    return json.slice(0, take) + suffix;
  }

  function safe(fn: () => Promise<any>): Promise<string> {
    return fn().then(
      (result) => truncateToolJson(JSON.stringify(result, null, 2)),
      (err: unknown) =>
        `Error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const operationalAndConfigTools = {
    get_system_info: tool({
      description:
        "Get PAN-OS system information including hostname, software version, serial number, uptime, and more.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp("<show><system><info></info></system></show>")
        ),
    }),

    get_ha_status: tool({
      description:
        "Get the high-availability (HA) status and state of the firewall.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp(
            "<show><high-availability><state></state></high-availability></show>"
          )
        ),
    }),

    get_interfaces: tool({
      description:
        "Get all network interfaces and their status, IP addresses, and zone assignments.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp("<show><interface>all</interface></show>")
        ),
    }),

    get_routing_table: tool({
      description:
        "Get the routing table (RIB) including static, connected, and dynamic routes.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp("<show><routing><route></route></routing></show>")
        ),
    }),

    get_arp_table: tool({
      description:
        "Get the ARP table showing IP-to-MAC address mappings.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp("<show><arp><entry>all</entry></arp></show>")
        ),
    }),

    get_session_info: tool({
      description:
        "Get session table summary information including session counts and throughput.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp(
            "<show><session><info></info></session></show>"
          )
        ),
    }),

    get_system_resources: tool({
      description:
        "Get system resource utilization including CPU, memory, and disk usage.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp(
            "<show><system><resources></resources></system></show>"
          )
        ),
    }),

    get_dhcp_leases: tool({
      description:
        "Get all DHCP server leases assigned by the firewall.",
      parameters: z.object({}),
      execute: async () =>
        safe(() =>
          client.executeOp(
            "<show><dhcp><server><lease>all</lease></server></dhcp></show>"
          )
        ),
    }),

    get_security_rules: tool({
      description:
        "Get all security (firewall) policy rules from the active configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/rulebase/security/rules`)),
    }),

    get_nat_rules: tool({
      description:
        "Get all NAT policy rules from the active configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/rulebase/nat/rules`)),
    }),

    get_address_objects: tool({
      description: "Get all address objects defined in the configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/address`)),
    }),

    get_address_groups: tool({
      description: "Get all address groups defined in the configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/address-group`)),
    }),

    get_service_objects: tool({
      description:
        "Get all service objects (protocol/port definitions) from the configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/service`)),
    }),

    get_service_groups: tool({
      description: "Get all service groups from the configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/service-group`)),
    }),

    get_tags: tool({
      description: "Get all tags defined in the configuration.",
      parameters: z.object({}),
      execute: async () =>
        safe(() => client.getConfig(`${VSYS_BASE}/tag`)),
    }),
  };

  const logTools = {
    get_traffic_logs: tool({
      description:
        "Query traffic logs from the firewall. Optionally filter with a PAN-OS log filter expression.",
      parameters: z.object(logParams),
      execute: async ({ filter, maxLogs }) =>
        safe(() => client.queryLogs("traffic", filter ?? "", maxLogs)),
    }),

    get_threat_logs: tool({
      description:
        "Query threat logs from the firewall. Optionally filter with a PAN-OS log filter expression.",
      parameters: z.object(logParams),
      execute: async ({ filter, maxLogs }) =>
        safe(() => client.queryLogs("threat", filter ?? "", maxLogs)),
    }),

    get_system_logs: tool({
      description:
        "Query system logs from the firewall. Optionally filter with a PAN-OS log filter expression.",
      parameters: z.object(logParams),
      execute: async ({ filter, maxLogs }) =>
        safe(() => client.queryLogs("system", filter ?? "", maxLogs)),
    }),

    get_config_logs: tool({
      description:
        "Query configuration audit logs from the firewall. Optionally filter with a PAN-OS log filter expression.",
      parameters: z.object(logParams),
      execute: async ({ filter, maxLogs }) =>
        safe(() => client.queryLogs("config", filter ?? "", maxLogs)),
    }),
  };

  if (includeLogTools) {
    return { ...operationalAndConfigTools, ...logTools };
  }

  return operationalAndConfigTools;
}
